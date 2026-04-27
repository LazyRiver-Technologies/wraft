from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, constr, Field
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from database import get_db
from middleware.auth import get_current_user
from services.limits import check_bot_limit, check_actions_limit, check_feature_access
import re

router = APIRouter()

# --- Pydantic Models ---
class BotCreate(BaseModel):
    name: str
    slug: str

class BotSettingsUpdate(BaseModel):
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_chunks: Optional[int] = None
    search_mode: Optional[str] = None
    fallback_message: Optional[str] = None
    guardrails_enabled: Optional[bool] = None

class BotAppearanceUpdate(BaseModel):
    theme_color: Optional[str] = None
    bot_name: Optional[str] = None
    bot_avatar: Optional[str] = None
    welcome_message: Optional[str] = None

class NotificationSettingsUpdate(BaseModel):
    owner_whatsapp: Optional[str] = None
    notify_on_lead: Optional[bool] = None
    notify_on_fallback: Optional[bool] = None
    notify_on_escalation: Optional[bool] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None

class BotActionCreate(BaseModel):
    name: str
    display_name: str
    description: str
    action_type: str
    config: Dict[str, Any] = Field(default_factory=dict)

class BotActionUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# --- Helper ---
async def verify_bot_ownership(bot_id: str, user, db) -> dict:
    bot_res = await db.table("bots").select("*").eq("id", bot_id).eq("owner_id", user.id).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found or not owned by user")
    return bot_res.data


# --- Endpoints ---

@router.post("")
async def create_bot(bot_req: BotCreate, user=Depends(get_current_user), db=Depends(get_db)):
    if not re.match(r"^[a-z0-9-]+$", bot_req.slug):
        raise HTTPException(status_code=400, detail="Slug must be URL-safe (lowercase letters, numbers, hyphens)")
        
    await check_bot_limit(user.id, db)
    
    # Insert bot
    try:
        insert_res = await db.table("bots").insert({
            "owner_id": user.id,
            "name": bot_req.name,
            "slug": bot_req.slug
        }).execute()
    except Exception as e:
        # Deterministic validation matching against Postgres SQL State 23505 (Unique Violation)
        if getattr(e, 'code', None) == '23505' or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
        raise HTTPException(status_code=500, detail=f"Database error creating bot: {str(e)}")
        
    new_bot = insert_res.data[0]
    
    # Retrieve full bot with relations. Note: assumes triggers work immediately.
    full_bot_res = await db.table("bots").select("*, bot_settings(*), bot_appearance(*)").eq("id", new_bot["id"]).single().execute()
    
    return full_bot_res.data

@router.get("")
async def list_bots(user=Depends(get_current_user), db=Depends(get_db)):
    # Returns bots, with chunk_count and message_count. Using separate queries or a view.
    # We will do subqueries using PostgREST standard relation queries if possible.
    # Otherwise, fetch bots and aggregate in python.
    bots_res = await db.table("bots").select("*").eq("owner_id", user.id).execute()
    bots = bots_res.data
    
    if not bots:
        return []
        
    bot_ids = [b["id"] for b in bots]
    
    # Manual query of chunk_counts from data_sources for simplicity and correctness
    # Actually, data_sources only track their chunk count, total chunk count per bot is sum.
    sources_res = await db.table("data_sources").select("bot_id, chunk_count").in_("bot_id", bot_ids).execute()
    chunk_counts = {}
    for s in sources_res.data:
        bid = s["bot_id"]
        chunk_counts[bid] = chunk_counts.get(bid, 0) + (s["chunk_count"] or 0)
        
    # message_count this month from usage_logs. Wait, spec says "this month".
    # Querying the `usage_logs` might require complex date filters, we'll assume there is a
    # generic message_count attached to the user logic, or query `usage_logs` created_at >= start of month.
    # Supabase allows filter `.gte("created_at", start_date)`. Since spec explicitly mention doing it:
    import datetime
    start_of_month = datetime.datetime.now(datetime.timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    # Query conversations instead of usage_logs since usage_logs tracks by owner_id, not bot_id
    conv_res = await db.table("conversations").select("bot_id, message_count").in_("bot_id", bot_ids).gte("created_at", start_of_month).execute()
    
    # Query leads count per bot
    leads_res = await db.table("leads").select("bot_id").in_("bot_id", bot_ids).execute()
    
    msg_counts = {}
    for conv in conv_res.data:
        bid = conv["bot_id"]
        msg_counts[bid] = msg_counts.get(bid, 0) + (conv.get("message_count", 0))
        
    lead_counts = {}
    for lead in (leads_res.data or []):
        bid = lead["bot_id"]
        lead_counts[bid] = lead_counts.get(bid, 0) + 1
        
    for b in bots:
        b["chunk_count"] = chunk_counts.get(b["id"], 0)
        b["message_count"] = msg_counts.get(b["id"], 0)
        b["lead_count"] = lead_counts.get(b["id"], 0)
        
    return bots

@router.get("/{bot_id}")
async def get_bot(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    bot_res = await db.table("bots").select(
        "*, bot_settings(*), bot_appearance(*), whatsapp_configs(*), data_sources(*)"
    ).eq("id", bot_id).single().execute()
    
    bot = bot_res.data
    
    # Mask whatsapp access token
    if bot.get("whatsapp_configs") and isinstance(bot["whatsapp_configs"], list) and len(bot["whatsapp_configs"]) > 0:
        cfg = bot["whatsapp_configs"][0]
        if cfg.get("access_token_enc"):
            cfg["access_token_enc"] = "****"
            
    return bot

ALLOWED_MODELS = [
    'gemini-2.5-flash-lite',   # primary — recommended
    'llama-3.1-8b-instant',    # groq direct — not recommended for Indian languages
]

@router.patch("/{bot_id}/settings")
async def update_bot_settings(bot_id: str, settings: BotSettingsUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    
    if "model" in update_data and update_data["model"] not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model selected")
        
    if not update_data:
        return {"status": "ok"}
        
    await db.table("bot_settings").upsert({
        "bot_id": bot_id,
        **update_data
    }).execute()
    return {"status": "updated"}

@router.patch("/{bot_id}/appearance")
async def update_bot_appearance(bot_id: str, appearance: BotAppearanceUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in appearance.model_dump().items() if v is not None}
    
    if "theme_color" in update_data:
        if not re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", update_data["theme_color"]):
            raise HTTPException(status_code=400, detail="theme_color must be a valid hex code")
            
    if not update_data:
         return {"status": "ok"}
         
    await db.table("bot_appearance").upsert({
        "bot_id": bot_id,
        **update_data
    }).execute()
    return {"status": "updated"}

@router.patch("/{bot_id}/notifications")
async def update_bot_notifications(bot_id: str, notifs: NotificationSettingsUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in notifs.model_dump().items() if v is not None}
    
    if not update_data:
         return {"status": "ok"}
         
    # Assuming notification_settings is standard upscale mapping
    await db.table("notification_settings").upsert({
        "bot_id": bot_id,
        **update_data
    }).execute()
    return {"status": "updated"}

@router.delete("/{bot_id}", status_code=204)
async def delete_bot(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await db.table("bots").delete().eq("id", bot_id).execute()
    return None

@router.post("/{bot_id}/playground/share")
async def share_playground(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    token = secrets.token_urlsafe(16)
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Execute native push bypassing schema locks dynamically. Ensure `frontend Origin` renders path logic cleanly.
    await db.table("playground_shares").insert({
        "bot_id": bot_id,
        "token": token,
        "expires_at": expires.isoformat()
    }).execute()
    
    return {
        "token": token,
        "expires_at": expires.isoformat()
    }

@router.get("/shared/{token}")
async def get_shared_bot(token: str, db=Depends(get_db)):
    res = await db.table("playground_shares").select("bot_id, expires_at").eq("token", token).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid token")
        
    expires_at_str = res.data.get("expires_at")
    if expires_at_str:
        expires_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_dt:
             raise HTTPException(status_code=410, detail="Token Expired")
        
    bot_id = res.data["bot_id"]
    b_res = await db.table("bots").select("id, name, slug, bot_appearance(*), bot_settings(lead_capture_enabled, lead_capture_trigger, lead_capture_message)").eq("id", bot_id).single().execute()
    if not b_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
        
    return b_res.data

# --- Bot Actions ---
ALLOWED_ACTION_TYPES = ["notify_owner", "calculate_quote", "check_availability"]

@router.post("/{bot_id}/actions")
async def create_bot_action(bot_id: str, action: BotActionCreate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_actions_limit(user.id, bot_id, db)
    
    if action.action_type not in ALLOWED_ACTION_TYPES:
        raise HTTPException(status_code=400, detail="Invalid action_type")
        
    if action.action_type == "check_availability":
        await check_feature_access(user.id, "check_availability", db)
    elif action.action_type == "calculate_quote":
        await check_feature_access(user.id, "calculate_quote", db)
        
    try:
        res = await db.table("bot_actions").insert({
            "bot_id": bot_id,
            "name": action.name,
            "display_name": action.display_name,
            "description": action.description,
            "action_type": action.action_type,
            "config": action.config
        }).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{bot_id}/actions")
async def get_bot_actions(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    res = await db.table("bot_actions").select("*").eq("bot_id", bot_id).execute()
    return res.data or []

@router.patch("/{bot_id}/actions/{action_id}")
async def update_bot_action(bot_id: str, action_id: str, update: BotActionUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if not update_data:
        return {"status": "ok"}
        
    res = await db.table("bot_actions").update(update_data).eq("id", action_id).eq("bot_id", bot_id).execute()
    if not res.data:
         raise HTTPException(status_code=404, detail="Action not found")
    return res.data[0]

@router.delete("/{bot_id}/actions/{action_id}", status_code=204)
async def delete_bot_action(bot_id: str, action_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await db.table("bot_actions").delete().eq("id", action_id).eq("bot_id", bot_id).execute()
    return None

from services.notifications import send_owner_notification

# --- Bot Notifications Testing ---
@router.post("/{bot_id}/notifications/test")
async def test_bot_notifications(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    """
    Test endpoint for WhatsApp business notifications.
    Checks notification_settings and sends a test explicit payload.
    """
    b_res = await verify_bot_ownership(bot_id, user, db)
    
    notif_res = await db.table("notification_settings").select("*").eq("bot_id", bot_id).single().execute()
    if not notif_res.data or not notif_res.data.get("owner_whatsapp"):
        raise HTTPException(status_code=400, detail="Owner WhatsApp number is safely missing from notification settings")
        
    try:
        from redis_client import get_redis
        redis = await get_redis()
    except Exception:
        redis = None
        
    success = await send_owner_notification(
        owner_whatsapp=notif_res.data.get("owner_whatsapp"),
        notification_type="new_lead", # Mapping native test format mapped in templates
        data={
            "bot_name": b_res.get("name", "Your Bot"),
            "name": "Platform Test",
            "phone": notif_res.data.get("owner_whatsapp"),
            "last_user_message": "This is an automatic platform structural test message structurally verifying delivery bounds."
        },
        bot_id=bot_id,
        db=db,
        redis=redis
    )
    
    if not success:
         raise HTTPException(status_code=500, detail="Message bounded correctly but failed mapping to WhatsApp API constraints. Verify platform token.")
         
    return {"status": "success", "message": "Test notification cleanly routed!"}
