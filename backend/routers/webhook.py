from fastapi import APIRouter, Request, Response, Depends, HTTPException, Header
from fastapi.responses import PlainTextResponse
from typing import Optional
from database import get_db
from redis_client import get_redis
from config import settings
from services.whatsapp import verify_meta_signature, parse_whatsapp_message, process_whatsapp_job
from services.limits import get_profile_with_plan
from fastapi import BackgroundTasks
import json

router = APIRouter()

@router.get("/whatsapp/{bot_slug}")
async def verify_whatsapp_webhook(
    bot_slug: str,
    request: Request,
    db=Depends(get_db)
):
    """
    Verification endpoint for Meta's Webhook subscriptions.
    """
    params = request.query_params
    hub_mode = params.get("hub.mode")
    hub_verify_token = params.get("hub.verify_token")
    hub_challenge = params.get("hub.challenge")

    if not hub_mode or not hub_verify_token:
        raise HTTPException(status_code=400, detail="Missing parameters")

    bot_res = await db.table("bots").select("whatsapp_configs(verify_token)").eq("slug", bot_slug).single().execute()
    
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    configs = bot_res.data.get("whatsapp_configs", [])
    if not configs:
        raise HTTPException(status_code=403, detail="WhatsApp config missing")
        
    actual_verify_token = configs[0].get("verify_token")

    if hub_mode == "subscribe" and hub_verify_token == actual_verify_token:
        # MUST return plain text challenge, not JSON
        return PlainTextResponse(hub_challenge)
    
    raise HTTPException(status_code=403, detail="Invalid verify token")


@router.post("/whatsapp/{bot_slug}")
async def handle_whatsapp_webhook(
    bot_slug: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
    redis=Depends(get_redis)
):
    """
    Ingests messages natively returning 200 within limits.
    """
    raw_payload_bytes = await request.body()
    signature_header = request.headers.get("x-hub-signature-256", "")
    
    bot_res = await db.table("bots").select("id, owner_id").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
         return Response(status_code=200)
         
    bot_id = bot_res.data["id"]
    owner_id = bot_res.data["owner_id"]
    webhook_log_id = None
    try:
        log_res = await db.table("webhook_logs").insert({
            "bot_id": bot_id,
            "channel": "whatsapp",
            "payload": json.loads(raw_payload_bytes.decode("utf-8") or "{}"),
            "status": "received"
        }).execute()
        if log_res.data:
            webhook_log_id = log_res.data[0]["id"]
    except Exception:
        webhook_log_id = None
    
    profile = await get_profile_with_plan(owner_id, db)
    if profile.get("plans", {}).get("name") == "trial":
        return Response(status_code=200)
    
    # 1. Verification block - Meta explicitly warns not to return 4xx to webhooks if processing errors out
    try:
        # Validate Meta Signature directly against local secrets bound to environment
        if not await verify_meta_signature(raw_payload_bytes, signature_header, settings.META_APP_SECRET):
            # Still returning 200 is acceptable for security checks so Meta drops the queue without retry.
            # But normally we can just return 200 and exit early. 
            # Or raise 403. Let's return 200 and silently drop invalid packets as best practice against DDOS.
            return Response(status_code=200)

        payload = await request.json()
    except Exception:
        # Return 200 on parse failures so Meta doesn't aggressively retry malformed packets
        return Response(status_code=200)

    # 2. Extract Data
    parsed_msg = parse_whatsapp_message(payload)
    if not parsed_msg:
         return Response(status_code=200)

    from_number, message_text, message_id = parsed_msg

    # 3. Prevent duplicate processing
    dedup_key = f"wa_msg:{message_id}"
    is_duplicate = await redis.exists(dedup_key) if redis is not None else False
    
    if is_duplicate:
         return Response(status_code=200)
         
    if redis is not None:
        await redis.set(dedup_key, "1", ex=86400) # Expire duplicate key linearly at 24 hours

    # 4. Enqueue Heavy Duty Work to BullMQ mapping natively under 5 seconds!
    
    background_tasks.add_task(process_whatsapp_job, bot_slug, bot_id, from_number, message_text, db, redis)
    if webhook_log_id:
        try:
            await db.table("webhook_logs").update({"status": "processed"}).eq("id", webhook_log_id).execute()
        except Exception:
            pass

    # 6. Webhooks acknowledge rapidly
    return Response(content="success", status_code=200)
