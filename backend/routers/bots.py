from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr, Field
from typing import Optional
from database import get_db
from middleware.auth import get_current_user
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

class BotAppearanceUpdate(BaseModel):
    theme_color: Optional[str] = None
    bot_name: Optional[str] = None
    bot_avatar: Optional[str] = None
    welcome_message: Optional[str] = None


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
        
    # Check plan bot limit
    plan_res = await db.table("profiles").select("plan_id, plans(*)").eq("id", user.id).single().execute()
    profile = plan_res.data if plan_res else {}
    
    # If the user has a plan, check limit.
    plan = profile.get("plans") if profile else None
    
    if plan and plan.get("max_bots") is not None:
        bots_count_res = await db.table("bots").select("id", count="exact").eq("owner_id", user.id).execute()
        current_bots = bots_count_res.count if bots_count_res.count is not None else 0
        if current_bots >= plan.get("max_bots"):
             raise HTTPException(status_code=403, detail="Bot limit reached for your plan")
             
    # Insert bot
    try:
        insert_res = await db.table("bots").insert({
            "owner_id": user.id,
            "name": bot_req.name,
            "slug": bot_req.slug
        }).execute()
    except Exception as e:
        if "bots_slug_key" in str(e) or "duplicate key value" in str(e):
            raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
        raise HTTPException(status_code=500, detail="Database error creating bot.")
        
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
    
    msg_counts = {}
    for conv in conv_res.data:
        bid = conv["bot_id"]
        msg_counts[bid] = msg_counts.get(bid, 0) + (conv.get("message_count", 0))
        
    for b in bots:
        b["chunk_count"] = chunk_counts.get(b["id"], 0)
        b["message_count"] = msg_counts.get(b["id"], 0)
        
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
        
    await db.table("bot_settings").update(update_data).eq("bot_id", bot_id).execute()
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
         
    await db.table("bot_appearance").update(update_data).eq("bot_id", bot_id).execute()
    return {"status": "updated"}

@router.delete("/{bot_id}", status_code=204)
async def delete_bot(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await db.table("bots").delete().eq("id", bot_id).execute()
    return None
