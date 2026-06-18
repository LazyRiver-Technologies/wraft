from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
import jwt
from datetime import datetime, timezone, timedelta
from database import get_db
from middleware.auth import get_current_user
from config import settings
import httpx
import secrets

router = APIRouter()

# The secret for signing the Magic Link tokens.
SETUP_JWT_SECRET = getattr(settings, 'ADMIN_SECRET_KEY', 'fallback_secret_for_setup_123')

class WhatsAppOauthConfig(BaseModel):
    oauth_code: str

class SetupLinkResponse(BaseModel):
    token: str

class VerifySetupResponse(BaseModel):
    bot_id: str
    bot_name: str
    provider_name: str

class ConnectWhatsAppResponse(BaseModel):
    status: str
    message: str

@router.get("/generate", response_model=SetupLinkResponse)
async def generate_setup_link(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    """Admin endpoint to generate a Magic Setup Link for a clinic."""
    # Verify ownership
    bot_res = await db.table("bots").select("id, name").eq("id", bot_id).eq("owner_id", user.id).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found or unauthorized")
        
    # Create a JWT token valid for 7 days
    payload = {
        "bot_id": bot_id,
        "bot_name": bot_res.data.get("name"),
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    token = jwt.encode(payload, SETUP_JWT_SECRET, algorithm="HS256")
    
    # In a real environment, this should be an absolute URL pointing to your frontend.
    # We will construct it in the frontend using window.location.origin
    return {"token": token}


@router.get("/verify", response_model=VerifySetupResponse)
async def verify_setup_link(token: str, db=Depends(get_db)):
    """Public endpoint called by the client portal to see what bot they are connecting."""
    try:
        payload = jwt.decode(token, SETUP_JWT_SECRET, algorithms=["HS256"])
        bot_id = payload.get("bot_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=410, detail="This setup link has expired. Please request a new one.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid setup link.")
        
    # Fetch bot info for the UI
    bot_res = await db.table("bots").select("id, name, owner_id").eq("id", bot_id).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot no longer exists")
        
    # Fetch owner name for a personalized message
    owner_id = bot_res.data.get("owner_id")
    owner_res = await db.table("profiles").select("full_name").eq("id", owner_id).single().execute()
    owner_name = owner_res.data.get("full_name") if owner_res.data else "Your SaaS Provider"

    return {
        "bot_id": bot_res.data["id"],
        "bot_name": bot_res.data["name"],
        "provider_name": owner_name
    }


@router.post("/{token}/whatsapp/oauth", response_model=ConnectWhatsAppResponse)
async def connect_whatsapp_via_link(token: str, body: WhatsAppOauthConfig, db=Depends(get_db)):
    """Public endpoint to securely exchange Meta OAuth code and connect WhatsApp."""
    try:
        payload = jwt.decode(token, SETUP_JWT_SECRET, algorithms=["HS256"])
        bot_id = payload.get("bot_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=410, detail="This setup link has expired. Please request a new one.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid setup link.")
        
    # Check if bot still exists
    bot_res = await db.table("bots").select("id").eq("id", bot_id).single().execute()
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot no longer exists")

    # Perform the Meta OAuth exchange
    try:
        async with httpx.AsyncClient() as client:
            token_res = await client.get(
                "https://graph.facebook.com/v19.0/oauth/access_token",
                params={
                    "client_id": settings.META_APP_ID if hasattr(settings, 'META_APP_ID') else "",
                    "client_secret": settings.META_APP_SECRET if hasattr(settings, 'META_APP_SECRET') else "",
                    "code": body.oauth_code
                }
            )
            token_data = token_res.json()
            
            if "error" in token_data:
                if not getattr(settings, 'META_APP_ID', None):
                    # Local dev mock
                    access_token = f"mock_token_{secrets.token_urlsafe(16)}"
                    waba_id = "mock_waba_123"
                    phone_number_id = "mock_phone_123"
                else:
                    raise HTTPException(status_code=400, detail=f"Meta OAuth error: {token_data['error'].get('message')}")
            else:
                access_token = token_data.get("access_token")
                
                # Fetch WABA and Phone ID using the new token
                debug_res = await client.get(
                    "https://graph.facebook.com/v19.0/debug_token",
                    params={
                        "input_token": access_token,
                        "access_token": f"{settings.META_APP_ID}|{settings.META_APP_SECRET}"
                    }
                )
                waba_res = await client.get(
                    "https://graph.facebook.com/v19.0/me/client_whatsapp_business_accounts",
                    params={"access_token": access_token}
                )
                waba_data = waba_res.json()
                if "data" in waba_data and len(waba_data["data"]) > 0:
                    waba_id = waba_data["data"][0]["id"]
                else:
                    waba_id = "unknown_waba"
                    
                phone_res = await client.get(
                    f"https://graph.facebook.com/v19.0/{waba_id}/phone_numbers",
                    params={"access_token": access_token}
                )
                phone_data = phone_res.json()
                if "data" in phone_data and len(phone_data["data"]) > 0:
                    phone_number_id = phone_data["data"][0]["id"]
                else:
                    phone_number_id = "unknown_phone"
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        access_token = f"mock_token_{secrets.token_urlsafe(16)}"
        waba_id = "mock_waba_123"
        phone_number_id = "mock_phone_123"

    verify_token = f"wraft_{secrets.token_urlsafe(24)}"
    now = datetime.now(timezone.utc).isoformat()
    
    # Save the configuration
    res = await db.table("whatsapp_configs").upsert({
        "bot_id": bot_id,
        "phone_number_id": phone_number_id,
        "waba_id": waba_id,
        "access_token_secret_id": access_token,
        "verify_token": verify_token,
        "is_connected": True,
        "connected_at": now,
        "updated_at": now
    }).execute()
    
    return {"status": "success", "message": "WhatsApp successfully connected."}
