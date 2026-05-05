from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from middleware.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/profiles", tags=["profiles"])

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    business_name: Optional[str] = None
    city: Optional[str] = None
    primary_language: Optional[str] = None
    avatar_url: Optional[str] = None

@router.patch("/me")
async def update_my_profile(
    profile_data: ProfileUpdate, 
    user=Depends(get_current_user), 
    db=Depends(get_db)
):
    update_dict = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if not update_dict:
        return {"status": "ok", "message": "No fields to update"}
        
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    try:
        res = await db.table("profiles").update(update_dict).eq("id", user.id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
