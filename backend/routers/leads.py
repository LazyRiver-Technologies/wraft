from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from database import get_db
from middleware.auth import get_current_user
from routers.bots import verify_bot_ownership
from services.limits import check_feature_access
import csv
import io

router = APIRouter()

class LeadUpdate(BaseModel):
    is_contacted: Optional[bool] = None
    notes: Optional[str] = None

@router.get("/leads")
async def get_all_leads(
    page: int = Query(1, ge=1),
    user=Depends(get_current_user), 
    db=Depends(get_db)
):
    await check_feature_access(user.id, "lead_capture", db)
    # Fetch all bots owned by user
    bots_res = await db.table("bots").select("id").eq("owner_id", user.id).execute()
    bot_ids = [b["id"] for b in (bots_res.data or [])]
    
    if not bot_ids:
        return {"data": [], "count": 0, "page": page, "page_size": 20}

    page_size = 20
    offset = (page - 1) * page_size

    query = db.table("leads").select("*, bots(name)").in_("bot_id", bot_ids)
    res = await query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    
    # Get total count
    count_res = await db.table("leads").select("id", count="exact").in_("bot_id", bot_ids).execute()
    
    return {
        "data": res.data or [],
        "count": count_res.count or 0,
        "page": page,
        "page_size": page_size
    }

@router.get("/{bot_id}/leads")
async def get_leads(
    bot_id: str, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: Optional[str] = None,
    is_contacted: Optional[bool] = None,
    page: int = Query(1, ge=1),
    user=Depends(get_current_user), 
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "lead_capture", db)

    page_size = 20
    offset = (page - 1) * page_size

    query = db.table("leads").select("*", count="exact").eq("bot_id", bot_id)

    if start_date:
        query = query.gte("created_at", start_date)
    if end_date:
        query = query.lte("created_at", end_date)
    if channel and channel != "all":
        query = query.eq("channel", channel)
    if is_contacted is not None:
        query = query.eq("is_contacted", is_contacted)

    res = await query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    
    return {
        "data": res.data or [],
        "count": res.count or 0,
        "page": page,
        "page_size": page_size
    }

@router.patch("/{bot_id}/leads/{lead_id}")
async def update_lead(bot_id: str, lead_id: str, payload: LeadUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        return {"status": "ok"}
        
    res = await db.table("leads").update(update_data).eq("id", lead_id).eq("bot_id", bot_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    return res.data[0]

@router.delete("/{bot_id}/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(bot_id: str, lead_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("leads").delete().eq("id", lead_id).eq("bot_id", bot_id).execute()
    return None

@router.get("/{bot_id}/leads/export")
async def export_leads(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "leads_export", db)
    
    # Fetch all leads for export (no pagination limit for CSV generation)
    res = await db.table("leads").select("*").eq("bot_id", bot_id).order("created_at", desc=True).execute()
    
    leads = res.data or []
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Columns: Name, Phone, Email, City, Channel, Date, Contacted, Notes, Context summary
    writer.writerow(["Name", "Phone", "Email", "City", "Channel", "Date", "Contacted", "Notes", "Context summary"])
    
    for lead in leads:
        # Resolve Context summary
        context = lead.get("context", [])
        context_str = ""
        if isinstance(context, list) and len(context) > 0:
            context_str = " | ".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in context])
            
        writer.writerow([
            lead.get("name", "Anonymous"),
            lead.get("phone", ""),
            lead.get("email", ""),
            lead.get("city", ""),
            lead.get("channel", "web"),
            lead.get("created_at", ""),
            "Yes" if lead.get("is_contacted") else "No",
            lead.get("notes", ""),
            context_str[:200] + "..." if len(context_str) > 200 else context_str
        ])
        
    csv_content = output.getvalue()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=leads_{bot_id}.csv"
        }
    )
