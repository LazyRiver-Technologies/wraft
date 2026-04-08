from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr, Field
from typing import Optional
from datetime import datetime, timezone
from database import get_db
from redis_client import get_redis
from services.rag import get_rag_response

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
    bot_res = await db.table("bots").select("id, is_active, owner_id, bot_settings(*)").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    bot = bot_res.data
    if not bot.get("is_active", True):
        raise HTTPException(status_code=404, detail="Bot is disabled")
        
    bot_id = bot["id"]
    bot_settings = bot.get("bot_settings") or {}

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

    # Generate RAG response
    rag_result = await get_rag_response(
        question=req.message,
        bot_id=bot_id,
        bot_settings=bot_settings,
        conversation_history=history,
        db=db,
        redis=redis
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

    # Update Conversation Stats
    new_message_count = conversation.get("message_count", 0) + 1
    now_str = datetime.now(timezone.utc).isoformat()
    await db.table("conversations").update({
        "message_count": new_message_count,
        "last_active_at": now_str
    }).eq("id", conversation_id).execute()

    # Insert Analytics Events
    # Usually "message_sent" (user) and "message_received" (bot)
    events = [
        {"bot_id": bot_id, "event_type": "message_sent", "session_id": req.session_id},
        {"bot_id": bot_id, "event_type": "message_received", "session_id": req.session_id}
    ]
    await db.table("analytics_events").insert(events).execute()

    return {
        "response": rag_result["response"],
        "session_id": req.session_id,
        "sources": rag_result["sources"],
        "cache_hit": rag_result["cache_hit"]
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
    bot_res = await db.table("bots").select("id, bot_appearance(*)").eq("slug", bot_slug).single().execute()
    if not bot_res.data:
         raise HTTPException(status_code=404, detail="Bot not found")
         
    appearance = bot_res.data.get("bot_appearance") or {}
    return {
        "theme_color": appearance.get("theme_color", "#4f46e5"),
        "welcome_message": appearance.get("welcome_message", "Hi there! How can I help you today?"),
        "placeholder_text": appearance.get("placeholder_text", "Type your message..."),
        "position": appearance.get("position", "bottom-right")
    }
