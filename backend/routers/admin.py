from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from config import settings
from database import get_db
from redis_client import get_redis
from middleware.admin_auth import require_admin, log_admin_action, login_attempts, MAX_ATTEMPTS, LOCKOUT_SECONDS, check_ip_whitelist
from services.admin_stats import (
    get_business_metrics, 
    get_system_health, 
    get_users_table, 
    get_bot_health_table, 
    get_guardrail_stats
)

router = APIRouter()

class AdminLoginRequest(BaseModel):
    password: str

@router.post("/login")
async def admin_login(req: AdminLoginRequest, request: Request):
    check_ip_whitelist(request)
    
    ip = request.client.host if request.client else "unknown"
    
    # Rate limiting
    now = datetime.now().timestamp()
    attempt_info = login_attempts.get(ip, {"count": 0, "lockout_until": 0})
    
    if attempt_info["lockout_until"] > now:
        raise HTTPException(status_code=429, detail=f"Locked out. Try again later.")
        
    if not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=500, detail="Admin password not configured")

    # Verify password
    try:
        is_valid = bcrypt.checkpw(req.password.encode('utf-8'), settings.ADMIN_PASSWORD_HASH.encode('utf-8'))
    except Exception as e:
        is_valid = False
        
    if not is_valid:
        attempt_info["count"] += 1
        if attempt_info["count"] >= MAX_ATTEMPTS:
            attempt_info["lockout_until"] = now + LOCKOUT_SECONDS
            attempt_info["count"] = 0
        login_attempts[ip] = attempt_info
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Reset attempts on success
    if ip in login_attempts:
        del login_attempts[ip]
        
    # Generate JWT
    exp = datetime.now(timezone.utc) + timedelta(hours=8)
    token = jwt.encode(
        {"sub": "admin", "exp": exp},
        settings.ADMIN_SECRET_KEY,
        algorithm="HS256"
    )
    
    return {"token": token, "expires_at": exp.isoformat()}


@router.get("/metrics")
async def get_metrics(admin=Depends(require_admin), db=Depends(get_db)):
    metrics = await get_business_metrics(db)
    return metrics

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
async def get_user_details(user_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    profile_res = await db.table("profiles").select("*, plans!inner(*)").eq("id", user_id).single().execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    bots_res = await db.table("bots").select("id, name, slug, is_active, created_at").eq("owner_id", user_id).execute()
    
    return {
        "profile": profile_res.data,
        "bots": bots_res.data or []
    }

class PlanUpdateReq(BaseModel):
    plan_name: str
    reason: str

@router.patch("/users/{user_id}/plan")
async def update_user_plan(user_id: str, req: PlanUpdateReq, admin=Depends(require_admin), db=Depends(get_db)):
    plan_res = await db.table("plans").select("id").eq("name", req.plan_name).single().execute()
    if not plan_res.data:
        raise HTTPException(status_code=400, detail="Invalid plan")
        
    await db.table("profiles").update({"plan_id": plan_res.data["id"]}).eq("id", user_id).execute()
    
    await log_admin_action("update_plan", user_id, {"new_plan": req.plan_name, "reason": req.reason}, db)
    return {"status": "success"}

class ExtendTrialReq(BaseModel):
    days: int
    reason: str

@router.patch("/users/{user_id}/extend-trial")
async def extend_trial(user_id: str, req: ExtendTrialReq, admin=Depends(require_admin), db=Depends(get_db)):
    # get current extended days
    p_res = await db.table("profiles").select("trial_extended_days").eq("id", user_id).single().execute()
    if not p_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_days = p_res.data.get("trial_extended_days", 0) + req.days
    
    await db.table("profiles").update({"trial_extended_days": new_days}).eq("id", user_id).execute()
    await log_admin_action("extend_trial", user_id, {"days": req.days, "reason": req.reason}, db)
    return {"status": "success"}

class BanReq(BaseModel):
    reason: str

@router.patch("/users/{user_id}/ban")
async def ban_user(user_id: str, req: BanReq, admin=Depends(require_admin), db=Depends(get_db)):
    await db.table("profiles").update({
        "is_banned": True,
        "banned_reason": req.reason
    }).eq("id", user_id).execute()
    
    await db.table("bots").update({"is_active": False}).eq("owner_id", user_id).execute()
    
    await log_admin_action("ban_user", user_id, {"reason": req.reason}, db)
    return {"status": "success"}

@router.patch("/users/{user_id}/unban")
async def unban_user(user_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    await db.table("profiles").update({
        "is_banned": False,
        "banned_reason": None
    }).eq("id", user_id).execute()
    
    await db.table("bots").update({"is_active": True}).eq("owner_id", user_id).execute()
    
    await log_admin_action("unban_user", user_id, {}, db)
    return {"status": "success"}

class NotesReq(BaseModel):
    notes: str

@router.patch("/users/{user_id}/notes")
async def update_user_notes(user_id: str, req: NotesReq, admin=Depends(require_admin), db=Depends(get_db)):
    await db.table("profiles").update({"admin_notes": req.notes}).eq("id", user_id).execute()
    await log_admin_action("update_notes", user_id, {}, db)
    return {"status": "success"}

@router.get("/bots")
async def list_bots(
    limit: int = 50, 
    offset: int = 0,
    admin=Depends(require_admin), 
    db=Depends(get_db)
):
    data = await get_bot_health_table(db, limit, offset)
    return data

@router.delete("/bots/{bot_id}")
async def delete_bot(bot_id: str, reason: str = Query(...), admin=Depends(require_admin), db=Depends(get_db)):
    await db.table("bots").delete().eq("id", bot_id).execute()
    await log_admin_action("delete_bot", bot_id, {"reason": reason}, db)
    return {"status": "success"}

@router.get("/guardrail-stats")
async def guardrail_stats(admin=Depends(require_admin), db=Depends(get_db)):
    stats = await get_guardrail_stats(db)
    return stats

@router.get("/feature-flags")
async def list_feature_flags(admin=Depends(require_admin), db=Depends(get_db)):
    res = await db.table("feature_flags").select("*").order("flag_name").execute()
    return {"data": res.data or []}

class FeatureFlagUpdate(BaseModel):
    is_enabled: bool
    enabled_for: str
    specific_user_ids: list[str] = []

@router.patch("/feature-flags/{flag_name}")
async def update_feature_flag(flag_name: str, req: FeatureFlagUpdate, admin=Depends(require_admin), db=Depends(get_db)):
    valid_targets = ['all', 'paid', 'pro_above', 'scale', 'specific']
    if req.enabled_for not in valid_targets:
        raise HTTPException(status_code=400, detail="Invalid enabled_for value")
        
    await db.table("feature_flags").update({
        "is_enabled": req.is_enabled,
        "enabled_for": req.enabled_for,
        "specific_user_ids": req.specific_user_ids,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("flag_name", flag_name).execute()
    
    await log_admin_action("update_feature_flag", flag_name, req.model_dump(), db)
    return {"status": "success"}
