from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, Field
from typing import Dict, Any

from database import get_db
from redis_client import get_redis
from repositories.chat_repository import ChatRepository
from services.chat_service import ChatService

from config import settings
from fastapi_limiter.depends import RateLimiter
from fastapi_limiter import FastAPILimiter

router = APIRouter()

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    session_id: str
    channel: str = Field(default="web", pattern="^(web|whatsapp)$")

async def rate_limit_if_ready(request: Request):
    if getattr(FastAPILimiter, "redis", None) is not None:
        limiter = RateLimiter(times=10, seconds=60)
        return await limiter(request)

@router.post("/{bot_slug}", dependencies=[Depends(rate_limit_if_ready)])
async def send_chat_message(bot_slug: str, req: ChatRequest, background_tasks: BackgroundTasks, db=Depends(get_db), redis=Depends(get_redis)):
    repo = ChatRepository(db)
    service = ChatService(repo, db, redis)
    return await service.process_message(bot_slug, req.session_id, req.channel, req.message, background_tasks)

@router.get("/{bot_slug}/history/{session_id}")
async def get_chat_history(bot_slug: str, session_id: str, db=Depends(get_db)):
    repo = ChatRepository(db)
    bot = await repo.get_bot_basic(bot_slug)
    if not bot:
         raise HTTPException(status_code=404, detail="Bot not found")
         
    conv = await repo.get_conversation_by_session(bot["id"], session_id)
    if not conv:
         return []
         
    return await repo.get_full_history(conv["id"], limit=20)

@router.get("/{bot_slug}/appearance")
async def get_bot_appearance(bot_slug: str, db=Depends(get_db)):
    repo = ChatRepository(db)
    bot = await repo.get_bot_appearance(bot_slug)
    if not bot:
         raise HTTPException(status_code=404, detail="Bot not found")

    show_watermark = True
    if bot.get("owner_id"):
        show_watermark = await repo.get_profile_watermark(bot["owner_id"])

    appearance = bot.get("bot_appearance") or {}
    if isinstance(appearance, list):
         appearance = appearance[0] if appearance else {}

    return {
        "theme_color": appearance.get("theme_color", "#6366f1"),
        "welcome_message": appearance.get("welcome_message", "Hi! How can I help you?"),
        "placeholder_text": appearance.get("placeholder_text", "Ask me anything..."),
        "bot_avatar_url": appearance.get("bot_avatar_url"),
        "position": appearance.get("position", "bottom-right"),
        "launcher_icon": appearance.get("launcher_icon", "chat"),
        "bot_name": bot.get("name", "AI Bot"),
        "show_watermark": show_watermark
    }
