from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import asyncio
from config import settings
from database import get_db
from redis_client import get_redis
from middleware.admin_auth import (
    require_admin, log_admin_action, check_ip_whitelist,
    ADMIN_LOGIN_ATTEMPTS_KEY, MAX_ATTEMPTS, LOCKOUT_SECONDS
)
from services.admin_stats import (
    get_business_metrics, 
    get_system_health, 
    get_users_table, 
    get_bot_health_table, 
    get_guardrail_stats,
    get_mrr_history,
    get_plan_distribution,
    get_revenue_feed
)

from services.cache_service import get_system_timezones_cached

router = APIRouter()

@router.get("/timezones")
async def get_timezones(admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    """Cached timezone lookup to replace expensive DB view"""
    return await get_system_timezones_cached(db, redis)

from services.admin_events import publish_admin_event

class AdminLoginRequest(BaseModel):
    password: str

@router.post("/login")
async def admin_login(req: AdminLoginRequest, request: Request, redis=Depends(get_redis)):
    await check_ip_whitelist(request)
    
    ip = request.client.host if request.client else "unknown"
    attempts_key = ADMIN_LOGIN_ATTEMPTS_KEY.format(ip=ip)
    
    # Rate limiting via Redis when available; password verification still works if cache is down.
    attempts = await redis.get(attempts_key) if redis is not None else None
    if attempts and int(attempts) >= MAX_ATTEMPTS:
        ttl = await redis.ttl(attempts_key)
        raise HTTPException(status_code=429, detail=f"Too many attempts. Locked out for {ttl} seconds.")
        
    if not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Admin password not configured")

    # Verify password
    try:
        is_valid = bcrypt.checkpw(req.password.encode('utf-8'), settings.ADMIN_PASSWORD_HASH.encode('utf-8'))
    except Exception:
        is_valid = False
        
    if not is_valid:
        if redis is not None:
            await redis.incr(attempts_key)
            await redis.expire(attempts_key, LOCKOUT_SECONDS)
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Reset attempts on success
    if redis is not None:
        await redis.delete(attempts_key)
        
    # Generate JWT
    exp = datetime.now(timezone.utc) + timedelta(hours=8)
    token = jwt.encode(
        {"sub": "admin", "exp": exp, "iat": datetime.now(timezone.utc)},
        settings.ADMIN_SECRET_KEY,
        algorithm="HS256"
    )
    
    return {"token": token, "expires_at": exp.isoformat()}


@router.get("/metrics")
async def get_metrics(admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    from services.cache_service import get_admin_metrics_cached
    return await get_admin_metrics_cached(db, redis)

@router.get("/revenue-stats")
async def revenue_stats(admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    from services.cache_service import get_revenue_stats_cached
    return await get_revenue_stats_cached(db, redis)

@router.get("/system-health")
async def system_health(admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    health = await get_system_health(redis, db)
    return health

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    admin=Depends(require_admin), 
    db=Depends(get_db)
):
    data = await get_users_table(db, page, per_page, search, plan, sort_by, sort_dir)
    return data

@router.get("/users/{user_id}")
async def get_user_details(user_id: str, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    from services.cache_service import get_user_details_cached
    data = await get_user_details_cached(user_id, db, redis)
    if not data:
        raise HTTPException(status_code=404, detail="User not found")
    return data

class PlanUpdateReq(BaseModel):
    plan_name: str
    reason: str

@router.patch("/users/{user_id}/plan")
async def update_user_plan(user_id: str, req: PlanUpdateReq, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    plan_res = await db.table("plans").select("id").eq("name", req.plan_name).single().execute()
    if not plan_res.data:
        raise HTTPException(status_code=400, detail="Invalid plan")
        
    await db.table("profiles").update({"plan_id": plan_res.data["id"]}).eq("id", user_id).execute()
    await log_admin_action("update_plan", user_id, {"new_plan": req.plan_name, "reason": req.reason}, db)
    
    from services.cache_service import invalidate_admin_metrics, invalidate_user_details
    await invalidate_admin_metrics(redis)
    await invalidate_user_details(user_id, redis)
    await publish_admin_event("stats_update", {"message": f"Plan updated for {user_id}"}, redis)
    return {"status": "success"}

class ExtendTrialReq(BaseModel):
    days: int
    reason: str

@router.patch("/users/{user_id}/extend-trial")
async def extend_trial(user_id: str, req: ExtendTrialReq, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    p_res = await db.table("profiles").select("trial_extended_days").eq("id", user_id).single().execute()
    if not p_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_days = p_res.data.get("trial_extended_days", 0) + req.days
    await db.table("profiles").update({"trial_extended_days": new_days}).eq("id", user_id).execute()
    await log_admin_action("extend_trial", user_id, {"days": req.days, "reason": req.reason}, db)
    await publish_admin_event("stats_update", {"message": f"Trial extended for {user_id}"}, redis)
    return {"status": "success"}

class OverrideLimitReq(BaseModel):
    extra_messages: int
    reason: str

@router.patch("/users/{user_id}/override-limit")
async def override_limit(user_id: str, req: OverrideLimitReq, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    # This assumes a column exists or we add to metadata
    await log_admin_action("override_limit", user_id, req.model_dump(), db)
    await publish_admin_event("stats_update", {"message": f"Limit override for {user_id}"}, redis)
    return {"status": "success"}

class BanReq(BaseModel):
    reason: str

@router.patch("/users/{user_id}/ban")
async def ban_user(user_id: str, req: BanReq, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    await db.table("profiles").update({
        "is_banned": True,
        "banned_reason": req.reason
    }).eq("id", user_id).execute()
    await db.table("bots").update({"is_active": False}).eq("owner_id", user_id).execute()
    await log_admin_action("ban_user", user_id, {"reason": req.reason}, db)
    
    from services.cache_service import invalidate_admin_metrics, invalidate_user_details
    await invalidate_admin_metrics(redis)
    await invalidate_user_details(user_id, redis)
    await publish_admin_event("stats_update", {"message": f"User banned: {user_id}"}, redis)
    return {"status": "success"}

@router.patch("/users/{user_id}/unban")
async def unban_user(user_id: str, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    await db.table("profiles").update({"is_banned": False, "banned_reason": None}).eq("id", user_id).execute()
    await db.table("bots").update({"is_active": True}).eq("owner_id", user_id).execute()
    await log_admin_action("unban_user", user_id, {}, db)
    await publish_admin_event("stats_update", {"message": f"User unbanned: {user_id}"}, redis)
    return {"status": "success"}

@router.post("/users/{user_id}/impersonate")
async def impersonate_user(user_id: str, reason: str = Query(...), admin=Depends(require_admin), db=Depends(get_db)):
    # Generate a short-lived token for the user
    # In a real app, this would use your auth provider's admin SDK
    await log_admin_action("impersonate", user_id, {"reason": reason}, db)
    return {"token": "impersonation_token_here", "expires_at": (datetime.now() + timedelta(minutes=30)).isoformat()}

@router.get("/bots")
async def list_bots(admin=Depends(require_admin), db=Depends(get_db)):
    return await get_bot_health_table(db)

@router.get("/bots/{bot_id}")
async def get_bot_details(bot_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    res = await db.table("bots").select("*, data_sources(*), whatsapp_configs(*)").eq("id", bot_id).single().execute()
    return res.data

@router.patch("/bots/{bot_id}/reindex")
async def reindex_bot(bot_id: str, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    sources = await db.table("data_sources").select("id").eq("bot_id", bot_id).execute()
    for s in sources.data:
        if redis is not None:
            await redis.lpush("bull:ingestion:wait", json.dumps({"source_id": s["id"]}))
    await log_admin_action("reindex_bot", bot_id, {}, db)
    return {"status": "enqueued"}

@router.delete("/bots/{bot_id}")
async def delete_bot(bot_id: str, reason: str = Query(...), admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    await db.table("bots").update({
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "is_active": False
    }).eq("id", bot_id).execute()
    await log_admin_action("delete_bot", bot_id, {"reason": reason}, db)
    await publish_admin_event("stats_update", {"message": f"Bot deleted: {bot_id}"}, redis)
    return {"status": "success"}

@router.get("/revenue-feed")
async def revenue_feed(limit: int = 20, admin=Depends(require_admin), db=Depends(get_db)):
    return await get_revenue_feed(db, limit)

@router.get("/guardrail-stats")
async def guardrail_stats(admin=Depends(require_admin), db=Depends(get_db)):
    return await get_guardrail_stats(db)

@router.get("/audit-logs")
async def audit_logs(page: int = 1, admin=Depends(require_admin), db=Depends(get_db)):
    res = await db.table("admin_audit_log").select("*").order("performed_at", desc=True).range((page-1)*20, page*20-1).execute()
    return res.data

@router.get("/feature-flags")
async def list_feature_flags(admin=Depends(require_admin), db=Depends(get_db)):
    res = await db.table("feature_flags").select("*").order("flag_name").execute()
    return res.data

class FeatureFlagUpdate(BaseModel):
    is_enabled: bool
    enabled_for: str
    specific_user_ids: list[str] = []

@router.patch("/feature-flags/{flag_name}")
async def update_feature_flag(flag_name: str, req: FeatureFlagUpdate, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    await db.table("feature_flags").update({
        "is_enabled": req.is_enabled,
        "enabled_for": req.enabled_for,
        "specific_user_ids": req.specific_user_ids,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("flag_name", flag_name).execute()
    await log_admin_action("update_feature_flag", flag_name, req.model_dump(), db)
    # Bust the flag cache used by AI/RAG services
    if redis is not None:
        await redis.delete(f"flag:{flag_name}")
    await publish_admin_event("stats_update", {"message": f"Flag updated: {flag_name}"}, redis)
    return {"status": "success"}

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    channel: str
    target_plans: list[str]
    scheduled_at: Optional[datetime] = None

@router.post("/announcements")
async def create_announcement(req: AnnouncementCreate, admin=Depends(require_admin), db=Depends(get_db)):
    res = await db.table("announcements").insert(req.model_dump()).execute()
    return res.data

@router.post("/announcements/{id}/send")
async def send_announcement(id: str, admin=Depends(require_admin), db=Depends(get_db), redis=Depends(get_redis)):
    await db.table("announcements").update({"status": "sending"}).eq("id", id).execute()
    # Logic to enqueue broadcast jobs in BullMQ
    return {"status": "broadcast_started"}

@router.get("/realtime-feed")
async def realtime_feed(
    token: Optional[str] = Query(None),
    admin=Depends(require_admin),
    redis=Depends(get_redis)
):
    """
    SSE stream for realtime admin events.
    Supports query param 'token' for EventSource compatibility.
    """
    async def event_generator():
        if redis is None:
            yield "event: heartbeat\ndata: redis_unavailable\n\n"
            return
        pubsub = redis.pubsub()
        await pubsub.subscribe("admin:feed")
        
        try:
            # Initial heartbeat
            yield "event: heartbeat\ndata: connected\n\n"
            
            while True:
                try:
                    # Wait for message with timeout to send heartbeats
                    message = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True),
                        timeout=30.0
                    )
                    
                    if message and message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode()
                        yield f"data: {data}\n\n"
                    else:
                        # Heartbeat every 30s
                        yield "event: heartbeat\ndata: ping\n\n"
                        
                except asyncio.TimeoutError:
                    # Connection alive check
                    yield "event: heartbeat\ndata: ping\n\n"
                    
        finally:
            await pubsub.unsubscribe("admin:feed")
            await pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
