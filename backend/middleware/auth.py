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
        
    return user_resp.user
