from datetime import datetime, timezone, timedelta
import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)

async def send_owner_notification(
    owner_whatsapp: str,
    notification_type: str,
    data: dict,
    bot_id: str,
    db,
    redis
) -> bool:
    """
    Asynchronously fires platform-level WhatsApp updates to bot owners.
    Isolated from critical chatting pathways via strict Try/Except matrices.
    """
    try:
        if not settings.PLATFORM_WA_PHONE_NUMBER_ID or not settings.PLATFORM_WA_ACCESS_TOKEN:
            return False

        # 1. Fetch configuration bindings
        res = await db.table("notification_settings").select("*").eq("bot_id", bot_id).execute()
        if not res.data or len(res.data) == 0:
            return False
            
        ns = res.data[0]
        
        # 2. Extract ownership routing explicitly (prefer parameter if passed statically, else fallback to settings block)
        target_number = owner_whatsapp or ns.get("owner_whatsapp")
        if not target_number:
            return False
            
        # 3. Time bounds logic mathematically enforced against IST (UTC +5:30)
        ist_offset = timezone(timedelta(hours=5, minutes=30))
        current_hour = datetime.now(ist_offset).hour
        
        quiet_start = ns.get("quiet_hours_start", 23)
        quiet_end = ns.get("quiet_hours_end", 8)
        
        if quiet_start > quiet_end:
            # Crosses midnight boundary (e.g. 23:00 to 08:00)
            if current_hour >= quiet_start or current_hour < quiet_end:
                return False
        else:
            # Standard bounded logic
            if quiet_start <= current_hour < quiet_end:
                return False

        # 4. Strict caching rate-limit execution to avoid spam constraints
        limit_val = ns.get("min_interval_minutes", 5)
        key = f"notif_limit:{bot_id}"
        
        # We rely on redis check
        if await redis.exists(key):
            return False
            
        await redis.setex(key, limit_val * 60, 1)

        # 5. Type enablement check
        if notification_type == "new_lead" and not ns.get("notify_new_lead", True):
            return False
        if notification_type == "bot_fallback" and not ns.get("notify_fallback", True):
            return False
        if notification_type == "negative_sentiment" and not ns.get("notify_negative_sentiment", True):
            return False
        if notification_type == "escalation_requested" and not ns.get("notify_escalation", True):
            return False
            
        bot_name = data.get("bot_name", "Your AI Bot")
        formatted_message = ""
        
        dashboard_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "https://app.wraft.ai"
        
        # 6. Content matrix construction
        if notification_type == "new_lead":
            name = data.get("name", "Unknown")
            phone = data.get("phone", "")
            last_msg = data.get("last_user_message", "")
            formatted_message = (
                f"🔔 *New Lead — {bot_name}*\n\n"
                f"👤 {name}\n"
                f"📱 {phone}\n"
                f"💬 Asked: \"{last_msg}\"\n\n"
                f"Reply now: wa.me/{phone}"
            )
        elif notification_type == "bot_fallback":
            question = data.get("question", "")
            formatted_message = (
                f"⚠️ *Bot couldn't answer — {bot_name}*\n\n"
                f"❓ \"{question}\"\n\n"
                f"Add to bot: {dashboard_url}/dashboard/bots/{bot_id}/qa"
            )
        elif notification_type == "negative_sentiment":
            last_msg = data.get("last_message", "")
            formatted_message = (
                f"😟 *Unhappy customer — {bot_name}*\n\n"
                f"Customer seemed frustrated.\n"
                f"Last message: \"{last_msg}\"\n\n"
                f"View chat: {dashboard_url}/dashboard/bots/{bot_id}/activity"
            )
        elif notification_type == "escalation_requested":
            last_msg = data.get("last_message", "")
            formatted_message = (
                f"🙋 *Customer wants human help — {bot_name}*\n\n"
                f"\"{last_msg}\"\n\n"
                f"View chat: {dashboard_url}/dashboard/bots/{bot_id}/activity"
            )
        elif notification_type == "injection_attempt":
            last_msg = data.get("message", "")
            formatted_message = (
                f"⚠️ *Security Alert — {bot_name}*\n\n"
                f"Someone tried to manipulate your bot.\n\n"
                f"Message: \"{last_msg}\"\n\n"
                f"Your bot handled it safely. No action needed."
            )
        else:
            return False

        # 7. Execute graph routing
        url = f"https://graph.facebook.com/v19.0/{settings.PLATFORM_WA_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.PLATFORM_WA_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "to": target_number,
            "type": "text",
            "text": { "body": formatted_message, "preview_url": False }
        }
        
        async with httpx.AsyncClient() as client:
            res = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if res.status_code not in (200, 201):
                logger.error(f"Platform WA Notification Error: {res.text}")
                return False
                
        # Update persistent timestamp tracking
        now_str = datetime.now(timezone.utc).isoformat()
        await db.table("notification_settings").update({"last_notified_at": now_str}).eq("bot_id", bot_id).execute()
            
        return True

    except Exception as e:
        logger.error(f"Failed to process owner notification: {e}")
        return False
