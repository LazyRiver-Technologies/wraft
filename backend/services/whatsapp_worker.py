import asyncio
import logging
from datetime import datetime, timezone
from bullmq import Worker, Queue, Job
from config import settings
from database import get_db
from redis_client import redis_pool
from services.rag import get_rag_response
from services.whatsapp import send_whatsapp_message

logger = logging.getLogger(__name__)

_wa_worker: Worker | None = None

async def process_whatsapp_job(job: Job, job_token: str):
    """
    Processes incoming WhatsApp messages by invoking RAG and replying immediately via Meta API.
    """
    data = job.data
    bot_slug = data.get("bot_slug")
    bot_id = data.get("bot_id")
    session_id = data.get("session_id")
    message = data.get("message")
    
    db = await get_db()
    
    import redis.asyncio as redis
    redis_client = redis.Redis(connection_pool=redis_pool)
    
    try:
        # Fetch Bot Configurations
        bot_res = await db.table("bots").select("is_active, bot_settings(*), whatsapp_configs(*)").eq("id", bot_id).single().execute()
        
        if not bot_res.data:
            return
            
        bot = bot_res.data
        if not bot.get("is_active", True):
             return
             
        whatsapp_config = bot.get("whatsapp_configs", [])
        if not whatsapp_config or not isinstance(whatsapp_config, list):
             return
             
        # Supabase joins array of configs
        config = whatsapp_config[0]
        access_token = config.get("access_token_enc")
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
            conversation = new_conv.data[0]
            
        conversation_id = conversation["id"]

        # Local History
        history_res = await db.table("messages").select("user_message, assistant_message").eq("conversation_id", conversation_id).order("created_at", desc=True).limit(6).execute()
        raw_history = history_res.data or []
        history = raw_history[::-1]

        # Call RAG wrapper
        rag_result = await get_rag_response(
            question=message,
            bot_id=bot_id,
            bot_settings=bot_settings,
            conversation_history=history,
            db=db,
            redis=redis_client
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
        await db.table("messages").insert({
            "conversation_id": conversation_id,
            "bot_id": bot_id,
            "user_message": message,
            "assistant_message": bot_reply,
            "tokens_used": rag_result.get("tokens_used", 0),
            "cache_hit": rag_result.get("cache_hit", False),
            "latency_ms": rag_result.get("latency_ms", 0),
            "sources": rag_result.get("sources", [])
        }).execute()

        new_message_count = conversation.get("message_count", 0) + 1
        now_str = datetime.now(timezone.utc).isoformat()
        await db.table("conversations").update({
            "message_count": new_message_count,
            "last_active_at": now_str
        }).eq("id", conversation_id).execute()

        analytics_events = [
            {"bot_id": bot_id, "event_type": "message_sent", "session_id": session_id},
            {"bot_id": bot_id, "event_type": "message_received", "session_id": session_id}
        ]
        await db.table("analytics_events").insert(analytics_events).execute()

    finally:
        await redis_client.close()

async def enqueue_whatsapp_message(data: dict):
    import redis.asyncio as redis
    from redis_client import redis_pool
    redis_conn = redis.Redis(connection_pool=redis_pool)

    queue = Queue("whatsapp_message", {"connection": redis_conn})
    job = await queue.add("wa_process", data)
    await queue.close()
    return job

async def start_wa_worker():
    global _wa_worker
    
    import redis.asyncio as redis
    from redis_client import redis_pool
    redis_conn = redis.Redis(connection_pool=redis_pool)
        
    _wa_worker = Worker(
        "whatsapp_message",
        process_whatsapp_job,
        {"connection": redis_conn, "concurrency": 20}
    )

    def on_completed(job: Job, result: any):
        logger.info(f"WA Job {job.id} completed")

    def on_failed(job: Job, error: Exception):
        logger.error(f"WA Job {job.id} failed: {error}")

    _wa_worker.on("completed", on_completed)
    _wa_worker.on("failed", on_failed)

    logger.info("WhatsApp BullMQ Worker started.")

async def stop_wa_worker():
    global _wa_worker
    if _wa_worker:
        await _wa_worker.close()
