from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr, Field
from typing import Optional
from datetime import datetime, timezone
import re
import asyncio
from database import get_db
from redis_client import get_redis
from services.rag import get_rag_response
from services.notifications import send_owner_notification
from utils.limits import get_strict_plan

router = APIRouter()

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    session_id: str
    channel: str = Field(default="web", pattern="^(web|whatsapp)$")


@router.post("/{bot_slug}")
async def send_chat_message(bot_slug: str, req: ChatRequest, db=Depends(get_db), redis=Depends(get_redis)):
    """
    Public Endpoint for chatbot interactions via slug
    """
    # Verify Bot
    bot_res = await db.table("bots").select("id, is_active, name, owner_id, bot_settings(*), notification_settings(*)").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    bot = bot_res.data
    if not bot.get("is_active", True):
        raise HTTPException(status_code=404, detail="Bot is disabled")
        
    bot_id = bot["id"]
    owner_id = bot["owner_id"]
    bot_name = bot.get("name", "AI Bot")
    bot_settings = bot.get("bot_settings") or {}
    
    # Extract notification settings block globally
    raw_notifs = bot.get("notification_settings") or []
    ns = raw_notifs[0] if isinstance(raw_notifs, list) and len(raw_notifs) > 0 else {}
    owner_whatsapp = ns.get("owner_whatsapp")
    
    # 2. Strict Mathematical Constraints for the Billing Network
    strict_data = await get_strict_plan(owner_id, db)
    plan = strict_data["plan"]
    current_msg_count = strict_data["monthly_message_count"]
    
    if plan.get("max_messages_per_month") is not None:
         if current_msg_count >= plan["max_messages_per_month"]:
              # Map clean rejection so widget doesn't physically break, just blocks context
              return {
                  "response": "This bot has reached its monthly message limit. Please upgrade your plan to continue.",
                  "session_id": req.session_id,
                  "sources": [],
                  "cache_hit": False
              }

    # Fetch/Create Session
    conv_res = await db.table("conversations").select("*").eq("bot_id", bot_id).eq("session_id", req.session_id).execute()
    
    conversation = None
    if conv_res.data:
        conversation = conv_res.data[0]
    else:
        # Create logic
        new_conv = await db.table("conversations").insert({
            "bot_id": bot_id,
            "session_id": req.session_id,
            "channel": req.channel,
            "message_count": 0
        }).execute()
        conversation = new_conv.data[0]
        
    conversation_id = conversation["id"]

    # History (fetch last 6 messages)
    history_res = await db.table("messages").select("role, content").eq("conversation_id", conversation_id).order("created_at", desc=True).limit(6).execute()
    
    # Reverse to keep chronological order
    raw_history = history_res.data or []
    history = raw_history[::-1]

    # Pre-RAG Lead Capture Injection
    lead_capture_enabled = bot_settings.get("lead_capture_enabled", False)
    lead_trigger = bot_settings.get("lead_capture_trigger", 2)
    new_message_count = conversation.get("message_count", 0) + 1
    
    has_lead = False
    if lead_capture_enabled:
        lead_res = await db.table("leads").select("id").eq("conversation_id", conversation_id).execute()
        if lead_res.data and len(lead_res.data) > 0:
            has_lead = True

    if lead_capture_enabled and not has_lead and new_message_count == lead_trigger:
        trigger_msg = bot_settings.get("lead_capture_message", "May I have your name and WhatsApp number so we can follow up with you?")
        sys_prompt = bot_settings.get("system_prompt", "You are a helpful assistant.")
        bot_settings["system_prompt"] = sys_prompt + f"\n\n[LEAD CAPTURE DIRECTIVE: You must politely ask for their contact details exactly stating: '{trigger_msg}']"

    # Generate RAG response
    rag_result = await get_rag_response(
        question=req.message,
        bot_id=bot_id,
        bot_settings=bot_settings,
        conversation_history=history,
        owner_id=owner_id,
        channel=req.channel,
        db=db,
        redis=redis,
        bot_name=bot_name
    )

    await db.table("messages").insert([
        {
            "conversation_id": conversation_id,
            "role": "user",
            "content": req.message,
            "tokens_used": 0,
            "cache_hit": False,
            "sources": [],
            "latency_ms": 0
        },
        {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": rag_result["response"],
            "tokens_used": rag_result.get("tokens_used", 0),
            "cache_hit": rag_result.get("cache_hit", False),
            "latency_ms": rag_result.get("latency_ms", 0),
            "sources": rag_result.get("sources", [])
        }
    ]).execute()

    # Post-RAG Lead Capture Evaluator (Regex Binding)
    if lead_capture_enabled and not has_lead:
        phone_match = re.search(r'((\+91|91|0)?[6-9]\d{9})', req.message)
        if phone_match:
            phone_num = phone_match.group(1)
            # Build Context (last 3 messages)
            context_list = [{"role": m["role"], "content": m["content"]} for m in history[-2:]]
            context_list.append({"role": "user", "content": req.message})
            
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', req.message)
            name_match = re.search(r'(?:my name is|name is|i am|i\'m|mera naam|ನನ್ನ ಹೆಸರು)\s+([A-Za-z\u0900-\u097F\u0C80-\u0CFF ]{2,60})', req.message, re.IGNORECASE)

            await db.table("leads").insert({
                "bot_id": bot_id,
                "conversation_id": conversation_id,
                "name": name_match.group(1).strip() if name_match else None,
                "phone": phone_num,
                "email": email_match.group(0) if email_match else None,
                "channel": req.channel,
                "context": context_list
            }).execute()

            # TRIGGER 1 - New Lead Notification
            if owner_whatsapp:
                asyncio.create_task(
                    send_owner_notification(
                        owner_whatsapp=owner_whatsapp,
                        notification_type="new_lead",
                        data={
                            "bot_name": bot_name,
                            "name": name_match.group(1).strip() if name_match else "Anonymous",
                            "phone": phone_num,
                            "last_user_message": req.message[:100]
                        },
                        bot_id=bot_id, db=db, redis=redis
                    )
                )

    # ---------------------------------------------------------
    # NON-BLOCKING TRIGGER EVALUATIONS
    # ---------------------------------------------------------
    
    if owner_whatsapp:
        # TRIGGER 2 - Bot fallback 
        if rag_result.get("response") == bot_settings.get("fallback_message"):
            asyncio.create_task(
                send_owner_notification(
                    owner_whatsapp=owner_whatsapp,
                    notification_type="bot_fallback",
                    data={
                        "bot_name": bot_name,
                        "question": req.message[:200]
                    },
                    bot_id=bot_id, db=db, redis=redis
                )
            )

        # TRIGGER 3 - Negative Sentiment
        # Assuming format was saved as rag_result["sentiment_score"] during generation limits
        sentiment_score = rag_result.get("sentiment_score", 0.0)
        if sentiment_score < -0.3:
            asyncio.create_task(
                send_owner_notification(
                    owner_whatsapp=owner_whatsapp,
                    notification_type="negative_sentiment",
                    data={
                        "bot_name": bot_name,
                        "last_message": req.message[:150]
                    },
                    bot_id=bot_id, db=db, redis=redis
                )
            )

        # TRIGGER 4 - Escalation Intent Dictionary Evaluation
        ESCALATION_KEYWORDS = [
            "human", "agent", "person", "staff",
            "insaan", "banda", "koi", "manager",
            "ಮನುಷ್ಯ", "ಸಿಬ್ಬಂದಿ", "मनुष्य", "इंसान", "कोई आदमी"
        ]
        if any(kw in req.message.lower() for kw in ESCALATION_KEYWORDS):
            asyncio.create_task(
                send_owner_notification(
                    owner_whatsapp=owner_whatsapp,
                    notification_type="escalation_requested",
                    data={
                        "bot_name": bot_name,
                        "last_message": req.message[:150]
                    },
                    bot_id=bot_id, db=db, redis=redis
                )
            )

    # Update Conversation Stats
    now_str = datetime.now(timezone.utc).isoformat()
    await db.table("conversations").update({
        "message_count": new_message_count,
        "last_active_at": now_str
    }).eq("id", conversation_id).execute()
    
    # Actually increment the user's monthly limits. Prefer atomic RPC when deployed.
    try:
        await db.rpc("increment_profile_message_count", {
            "p_owner_id": owner_id,
            "p_increment": 1
        }).execute()
    except Exception:
        await db.table("profiles").update({
            "monthly_message_count": current_msg_count + 1
        }).eq("id", owner_id).execute()

    # Insert Analytics Events
    # Usually "message_sent" (user) and "message_received" (bot)
    events = [
        {"bot_id": bot_id, "event_type": "message_sent", "session_id": req.session_id, "properties": {"channel": req.channel}},
        {"bot_id": bot_id, "event_type": "message_received", "session_id": req.session_id, "properties": {"channel": req.channel}}
    ]
    
    # Addition 6 — Guardrail source to analytics
    source = rag_result.get("source", "")
    if source and source.startswith("guardrail_"):
        events.append({
            "bot_id": bot_id, 
            "event_type": "message_received", 
            "session_id": req.session_id,
            "properties": {
                "channel": req.channel,
                "guardrail_type": source,
                "question_preview": req.message[:50]
            }
        })
        
    await db.table("analytics_events").insert(events).execute()

    return {
        "response": rag_result["response"],
        "session_id": req.session_id,
        "sources": rag_result["sources"],
        "cache_hit": rag_result["cache_hit"],
        "confidence_score": rag_result.get("confidence_score", 0.0)
    }


@router.get("/{bot_slug}/history/{session_id}")
async def get_chat_history(bot_slug: str, session_id: str, db=Depends(get_db)):
    """
    Public Endpoint fetching last 20 messages for session GUI rehydration
    """
    bot_res = await db.table("bots").select("id").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
         raise HTTPException(status_code=404, detail="Bot not found")
         
    bot_id = bot_res.data["id"]
    
    conv_res = await db.table("conversations").select("id").eq("bot_id", bot_id).eq("session_id", session_id).single().execute()
    if not conv_res.data:
         # No history found, return empty array seamlessly
         return []
         
    conv_id = conv_res.data["id"]
         
    history_res = await db.table("messages").select("*").eq("conversation_id", conv_id).order("created_at", desc=True).limit(20).execute()
    
    data = history_res.data or []
    return data[::-1]

@router.get("/{bot_slug}/appearance")
async def get_bot_appearance(bot_slug: str, db=Depends(get_db)):
    """
    Public Endpoint fetching generic chat widget theme logic directly
    """
    bot_res = await db.table("bots").select("id, name, owner_id, bot_appearance(*)").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
         raise HTTPException(status_code=404, detail="Bot not found")
         
    bot_owner = bot_res.data.get("owner_id")
    bot_name = bot_res.data.get("name", "AI Bot")
    show_watermark = True
    
    if bot_owner:
        try:
            profile_res = await db.table("profiles").select("plans(show_watermark)").eq("id", bot_owner).single().execute()
            if profile_res.data and profile_res.data.get("plans"):
                # Access boolean flag directly
                show_watermark = profile_res.data["plans"].get("show_watermark", True)
        except Exception:
            pass

    appearance = bot_res.data.get("bot_appearance") or {}
    if isinstance(appearance, list):
         appearance = appearance[0] if appearance else {}

    return {
        "theme_color": appearance.get("theme_color", "#6366f1"),
        "welcome_message": appearance.get("welcome_message", "Hi! How can I help you?"),
        "placeholder_text": appearance.get("placeholder_text", "Ask me anything..."),
        "bot_avatar_url": appearance.get("bot_avatar_url"),
        "position": appearance.get("position", "bottom-right"),
        "launcher_icon": appearance.get("launcher_icon", "chat"),
        "bot_name": bot_name,
        "show_watermark": show_watermark
    }
