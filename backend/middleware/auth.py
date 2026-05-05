from fastapi import Header, Depends, HTTPException
from database import get_db

async def get_current_user(authorization: str = Header(None), db=Depends(get_db)):
    """
    Extracts the user from the Supabase JWT token.
    Throws 401 if token is invalid or missing.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")
        
    token = authorization.replace("Bearer ", "")
    
    try:
        user_resp = await db.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    # Check if the user is banned
    profile_resp = await db.table("profiles").select("is_banned").eq("id", user_resp.user.id).single().execute()
    if profile_resp.data and profile_resp.data.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
        
    return user_resp.user

async def get_admin_user(authorization: str = Header(None), db=Depends(get_db)):
    """
    Validates user and additionally verifies they have admin privileges
    by checking the `is_admin` flag on their profile.
    """
    user = await get_current_user(authorization, db)
    
    profile_resp = await db.table("profiles").select("is_admin").eq("id", user.id).single().execute()
    if not profile_resp.data or not profile_resp.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
        
    return user
