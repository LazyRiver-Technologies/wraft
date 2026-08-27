import hmac
import hashlib
import json
import httpx
import logging

logger = logging.getLogger(__name__)

class WhatsAppError(Exception):
    pass

BASE_URL = "https://graph.facebook.com/v19.0"

async def send_whatsapp_message(phone_number_id: str, access_token: str, to: str, message: str) -> None:
    """
    Sends a text message using the Meta WhatsApp Cloud API.
    Truncates message to 4096 characters.
    """
    if len(message) > 4096:
        message = message[:4093] + "..."
        
    url = f"{BASE_URL}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=15.0)
        
        if response.status_code != 200:
            err_msg = response.text
            try:
                err_data = response.json()
                err_msg = err_data.get("error", {}).get("message", err_msg)
            except Exception as e:
                logger.warning(f"Failed to parse Meta API error JSON: {e}")
            raise WhatsAppError(f"Meta API Error ({response.status_code}): {err_msg}")

async def verify_meta_signature(payload: bytes, signature: str, app_secret: str) -> bool:
    """
    Timing-safe HMAC-SHA256 signature verification for Meta webhooks.
    """
    if not signature or not signature.startswith("sha256="):
        return False
        
    signature_hash = signature.split("sha256=", 1)[1]
    
    expected_hmac = hmac.new(
        app_secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_hmac, signature_hash)

def parse_whatsapp_message(payload: dict) -> tuple[str, str, str] | None:
    """
    Extracts purely text WhatsApp messages from the Meta webhook payload.
    Returns (from_number, message_text, message_id) or None.
    """
    try:
        entries = payload.get("entry", [])
        if not entries:
            return None
            
        changes = entries[0].get("changes", [])
        if not changes:
            return None
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            return None
            
        message_obj = messages[0]
        
        # We ignore non-text messages for now
        if message_obj.get("type") != "text":
            return None
            
        from_number = message_obj.get("from")
        message_id = message_obj.get("id")
        message_text = message_obj.get("text", {}).get("body")
        
        if not from_number or not message_id or not message_text:
            return None
            
        return from_number, message_text, message_id
        
    except (IndexError, KeyError):
        return None

async def process_whatsapp_job(bot_slug: str, bot_id: str, session_id: str, message: str, db, redis_client):
    """
    Processes incoming WhatsApp messages by invoking RAG and replying immediately via Meta API natively via BackgroundTasks.
    """
    from datetime import datetime, timezone
    from services.rag import get_rag_response
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        class InlineBackgroundTasks:
            def __init__(self):
                self.tasks = []
            def add_task(self, func, *args, **kwargs):
                self.tasks.append((func, args, kwargs))
            async def execute_all(self):
                for func, args, kwargs in self.tasks:
                    try:
                        import inspect
                        if inspect.iscoroutinefunction(func):
                            await func(*args, **kwargs)
                        else:
                            func(*args, **kwargs)
                    except Exception as e:
                        logger.error(f"Inline background task error: {e}")
                        
        inline_bg_tasks = InlineBackgroundTasks()

        # Fetch Bot Configurations
        bot_res = await db.table("bots").select("is_active, owner_id, bot_settings(*), whatsapp_configs(*)").eq("id", bot_id).single().execute()
        
        if not bot_res.data:
            return
            
        from services.limits import check_feature_flag
        
        bot = bot_res.data
        owner_id = bot["owner_id"]
        
        # 1.1 Check Feature Flag
        # To avoid extra DB calls, we could pass plan from the profile but here we need it
        profile_res = await db.table("profiles").select("plans!inner(name, wa_notifications)").eq("id", owner_id).single().execute()
        plan = profile_res.data.get("plans", {}) if profile_res.data else {}
        plan_name = plan.get("name", "trial")
        if not plan.get("wa_notifications", False):
            logger.info(f"WhatsApp agent disabled by plan for user {owner_id}")
            return
        
        if not await check_feature_flag("whatsapp_agent", owner_id, plan_name, db, redis_client):
            logger.info(f"WhatsApp agent disabled by flag for user {owner_id}")
            return

        if not bot.get("is_active", True):
             return
             
        whatsapp_config = bot.get("whatsapp_configs", [])
        if not whatsapp_config or not isinstance(whatsapp_config, list):
             return
             
        # Supabase joins array of configs
        config = whatsapp_config[0]
        access_token = config.get("access_token_secret_id")
        phone_number_id = config.get("phone_number_id")
        
        if not access_token or not phone_number_id:
             return
             
        bot_settings = bot.get("bot_settings") or {}

        # Conversation sync
        conv_res = await db.table("conversations").select("*").eq("bot_id", bot_id).eq("session_id", session_id).execute()
        if conv_res.data:
            conversation = conv_res.data[0]
        else:
            new_conv = await db.table("conversations").insert({
                "bot_id": bot_id,
                "session_id": session_id,
                "channel": "whatsapp",
                "message_count": 0
            }).execute()
            if not new_conv.data:
                return
            conversation = new_conv.data[0]
            
        conversation_id = conversation["id"]

        # Local History
        history_res = await db.table("messages").select("role, content").eq("conversation_id", conversation_id).order("created_at", desc=True).limit(6).execute()
        raw_history = history_res.data or []
        history = raw_history[::-1]

        # Call RAG wrapper
        rag_result = await get_rag_response(
            question=message,
            bot_id=bot_id,
            bot_settings=bot_settings,
            conversation_history=history,
            owner_id=bot.get("owner_id", ""),
            channel="whatsapp",
            db=db,
            redis=redis_client,
            background_tasks=inline_bg_tasks,
            conversation_id=conversation_id
        )
        
        bot_reply = rag_result["response"]

        # Fire off completion message over API directly
        await send_whatsapp_message(
             phone_number_id=phone_number_id,
             access_token=access_token,
             to=session_id, # session_id maps directly to caller's `from_number` locally
             message=bot_reply
        )
        
        # Save messages identically mirroring chat routes
        await db.table("messages").insert([
            {
                "conversation_id": conversation_id,
                "bot_id": bot_id,
                "role": "user",
                "content": message,
                "tokens_in": len(message) // 4,
                "tokens_out": 0,
                "cost_paise": 0,
                "cache_hit": False,
                "sources": [],
                "latency_ms": 0
            },
            {
                "conversation_id": conversation_id,
                "bot_id": bot_id,
                "role": "assistant",
                "content": bot_reply,
                "tokens_in": 0,
                "tokens_out": rag_result.get("tokens_used", 0),
                "cost_paise": 0,
                "cache_hit": rag_result.get("cache_hit", False),
                "latency_ms": rag_result.get("latency_ms", 0),
                "sources": rag_result.get("sources", [])
            }
        ]).execute()

        new_message_count = conversation.get("message_count", 0) + 1
        now_str = datetime.now(timezone.utc).isoformat()
        await db.table("conversations").update({
            "message_count": new_message_count,
            "last_active_at": now_str
        }).eq("id", conversation_id).execute()

        try:
            await db.rpc("increment_profile_message_count", {
                "p_owner_id": owner_id,
                "p_increment": 1
            }).execute()
        except Exception as e:
            logger.error(f"CRITICAL: Failed to increment billing for owner {owner_id} via whatsapp: {e}")
            
        await inline_bg_tasks.execute_all()

        source = rag_result.get("source", "")
        if source and source.startswith("guardrail_"):
            events = [{
                "bot_id": bot_id, 
                "event_type": "message_received", 
                "session_id": session_id,
                "properties": {
                    "channel": "whatsapp",
                    "guardrail_type": source,
                    "question_preview": message[:50]
                }
            }]
            await db.table("analytics_events").insert(events).execute()



    except Exception as e:
        logger.error(f"BackgroundTasks Process WhatsApp dropped natively: {e}")
