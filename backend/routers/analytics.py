from fastapi import APIRouter, Depends, Query, HTTPException, Request, Response
from typing import Optional

from database import get_db
from middleware.auth import get_current_user
from fastapi_cache.decorator import cache
from routers.bots import verify_bot_ownership
from services.limits import check_feature_access

from repositories.analytics_repository import AnalyticsRepository
from services.analytics_service import AnalyticsService

router = APIRouter()

def analytics_key_builder(func, namespace: str = "", request: Request = None, response: Response = None, *args, **kwargs):
    # Retrieve user from kwargs (injected by Depends(get_current_user))
    user = kwargs.get("user")
    user_id = user.id if user else "anonymous"
    
    # Retrieve bot_id if present
    bot_id = kwargs.get("bot_id", "global")
    
    # Optional parameters
    channel = kwargs.get("channel", "all")
    start_date = kwargs.get("start_date", "none")
    end_date = kwargs.get("end_date", "none")

    return f"fastapi-cache:{namespace}:{func.__module__}:{func.__name__}:user:{user_id}:bot:{bot_id}:channel:{channel}:start:{start_date}:end:{end_date}"

def get_service(db) -> AnalyticsService:
    repo = AnalyticsRepository(db)
    return AnalyticsService(repo)

@router.get("/overview")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_global_overview(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    repo = AnalyticsRepository(db)
    bot_ids = await repo.get_bot_ids_for_owner(user.id)
    return await get_service(db).get_overview(user.id, bot_ids, start_date, end_date, channel)

@router.get("/conversations-over-time")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_global_conversations_over_time(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    repo = AnalyticsRepository(db)
    bot_ids = await repo.get_bot_ids_for_owner(user.id)
    return await get_service(db).get_conversations_over_time(bot_ids, start_date, end_date, channel)

@router.get("/{bot_id}/overview")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_bot_overview(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    return await get_service(db).get_overview(user.id, [bot_id], start_date, end_date, channel)

@router.get("/{bot_id}/conversations-over-time")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_bot_conversations_over_time(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    return await get_service(db).get_conversations_over_time([bot_id], start_date, end_date, channel)

@router.get("/{bot_id}/drop-off")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_drop_off(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    return await get_service(db).get_drop_off(bot_id, start_date, end_date, channel)

@router.get("/{bot_id}/sentiment")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_sentiment(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    return await get_service(db).get_sentiment(bot_id, start_date, end_date, channel)

@router.get("/{bot_id}/sources-performance")
@cache(expire=5, key_builder=analytics_key_builder)
async def get_sources_performance(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    return await get_service(db).get_sources_performance(bot_id, start_date, end_date, channel)

@router.get("/{bot_id}/suggestions")
async def get_suggestions(bot_id: str, status: str = Query("pending"), user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    repo = AnalyticsRepository(db)
    data = await repo.get_suggestions(bot_id, status)
    return {"data": data}

@router.patch("/{bot_id}/suggestions/{suggestion_id}")
async def patch_suggestion(bot_id: str, suggestion_id: str, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    s_val = payload.get("status")
    if s_val not in ("added_qa", "dismissed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    repo = AnalyticsRepository(db)
    await repo.update_suggestion_status(bot_id, suggestion_id, s_val)
    return {"status": "ok"}
