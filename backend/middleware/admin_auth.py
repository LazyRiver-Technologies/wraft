import jwt
import bcrypt
from fastapi import Request, HTTPException, Header
from config import settings
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Basic rate limit for admin login logic using an in-memory dictionary.
# In production, you would map this natively through Redis to properly bound multiple workers
login_attempts: dict = {}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 3600  # 1 hour

def check_ip_whitelist(request: Request):
    if not settings.ADMIN_ALLOWED_IPS:
        return  # no restriction
        
    client_ip = request.client.host if request.client else None
    if client_ip not in settings.ADMIN_ALLOWED_IPS:
        raise HTTPException(
            status_code=403,
            detail="Access denied from this IP"
        )

async def require_admin(
    request: Request,
    authorization: str = Header(None)
):
    check_ip_whitelist(request)
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(
            token,
            settings.ADMIN_SECRET_KEY,
            algorithms=["HS256"]
        )
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=401, detail="Invalid token subject")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return payload

async def log_admin_action(
    action: str,
    target_id: str,
    details: dict,
    db
):
    """Log every admin action for audit trail"""
    try:
        await db.table("admin_audit_log").insert({
            "action": action,
            "target_id": target_id,
            "details": details,
            "performed_at": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.error(f"Failed to write admin audit log: {e}")
