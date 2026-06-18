import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from database import get_db
from middleware.auth import get_current_user
from config import settings
from datetime import date, datetime, timezone
from redis_client import get_redis
import razorpay

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize Razorpay Client generically using standard python SDK bindings
rzp_client = None
if hasattr(settings, 'RAZORPAY_KEY_ID') and hasattr(settings, 'RAZORPAY_KEY_SECRET'):
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

@router.post("/create-subscription")
async def create_subscription(
    request: Request,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Creates a Razorpay subscription instance parsing the chosen plan boundaries
    """
    if not rzp_client:
        raise HTTPException(status_code=500, detail="Razorpay is not configured on this server.")
        
    payload = await request.json()
    plan_name = payload.get("plan_name")
    
    if not plan_name:
        raise HTTPException(status_code=400, detail="Must provide plan_name")
        
    plan_res = await db.table("plans").select("*").eq("name", plan_name.lower()).limit(1).execute()
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    plan = plan_res.data
    rz_plan_id = plan.get("razorpay_plan_id")
    
    # Map securely against statically defined environments if not in DB natively.
    if not rz_plan_id:
        fallback_maps = {
            "starter": getattr(settings, "RAZORPAY_STARTER_PLAN_ID", None),
            "growth": getattr(settings, "RAZORPAY_GROWTH_PLAN_ID", None),
            "scale": getattr(settings, "RAZORPAY_SCALE_PLAN_ID", None),
        }
        rz_plan_id = fallback_maps.get(plan_name.lower())
    
    if not rz_plan_id:
        raise HTTPException(status_code=400, detail="Plan does not have a mapped Razorpay Plan ID")

    try:
        profile_res = await db.table("profiles").select("email, razorpay_customer_id").eq("id", user.id).limit(1).execute()
        profile = profile_res.data[0] if profile_res.data else {}
        sub_payload = {
            "plan_id": rz_plan_id,
            "total_count": 12, # Defaulting 1 year recursion dynamically
            "customer_notify": 1,
            "notes": {
                "profile_id": user.id,
                "plan_name": plan["name"],
                "email": profile.get("email") or getattr(user, "email", "")
            }
        }
        if profile.get("razorpay_customer_id"):
            sub_payload["customer_id"] = profile["razorpay_customer_id"]

        sub = rzp_client.subscription.create(sub_payload)
        
        return {
            "subscription_id": sub["id"],
            "razorpay_key_id": settings.RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _get_plan_by_razorpay_id(db, rz_plan_id: str | None):
    if not rz_plan_id:
        return None
    plan_res = await db.table("plans").select("*").eq("razorpay_plan_id", rz_plan_id).limit(1).execute()
    return plan_res.data[0] if plan_res.data else None

async def _get_trial_plan(db):
    res = await db.table("plans").select("*").eq("name", "trial").limit(1).execute()
    if not res.data: raise HTTPException(status_code=404, detail='Not found')
    return res.data[0] if res.data else None

async def _apply_plan_change(db, redis, user_id: str, new_plan: dict, reason: str, subscription_id: str | None = None):
    profile_res = await db.table("profiles").select("plan_id, email").eq("id", user_id).limit(1).execute()
    profile = profile_res.data[0] if profile_res.data else {}
    old_plan_id = profile.get("plan_id")
    update_payload = {
        "plan_id": new_plan["id"],
        "billing_cycle_start": date.today().isoformat(),
        "monthly_message_count": 0,
        "trial_expired": False,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if subscription_id is not None:
        update_payload["razorpay_subscription_id"] = subscription_id

    await db.table("profiles").update(update_payload).eq("id", user_id).execute()
    await db.table("plan_changes").insert({
        "owner_id": user_id,
        "old_plan_id": old_plan_id,
        "new_plan_id": new_plan["id"],
        "reason": reason
    }).execute()

    from services.admin_events import publish_admin_event
    await publish_admin_event("plan_change", {
        "user_id": user_id,
        "email": profile.get("email"),
        "new_plan": new_plan.get("name"),
        "reason": reason
    }, redis)

@router.post("/webhook")
async def razorpay_webhook(request: Request, db=Depends(get_db), redis=Depends(get_redis)):
    """
    Public Endpoint capturing payment callbacks dynamically validating security hashes
    """
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    
    if not signature or not hasattr(settings, 'RAZORPAY_WEBHOOK_SECRET') or not settings.RAZORPAY_WEBHOOK_SECRET or not rzp_client:
        return Response(status_code=200)

    try:
        # Validate cryptography payload explicitly blocking tampered callbacks
        rzp_client.utility.verify_webhook_signature(
            raw_body.decode('utf-8'),
            signature,
            settings.RAZORPAY_WEBHOOK_SECRET
        )
    except Exception:
        # Ignore strictly
        return Response(status_code=200)

    try:
        payload = await request.json()
    except Exception:
        return Response(status_code=200)
        
    event = payload.get("event")
    event_entity = payload.get("payload", {}).get("payment", {}).get("entity") or payload.get("payload", {}).get("subscription", {}).get("entity") or {}
    event_id = event_entity.get("id") or payload.get("created_at") or signature
    dedupe_key = f"rzp_event:{event}:{event_id}"

    if redis is not None:
        try:
            if await redis.exists(dedupe_key):
                return Response(status_code=200)
            await redis.set(dedupe_key, "1", ex=7 * 86400)
        except Exception:
            pass

    webhook_log_id = None
    try:
        log_res = await db.table("webhook_logs").insert({
            "channel": "razorpay",
            "payload": payload,
            "status": "received"
        }).execute()
        if log_res.data:
            webhook_log_id = log_res.data[0]["id"]
    except Exception:
        webhook_log_id = None
    
    if event in {"payment.captured", "subscription.activated", "subscription.charged"}:
        try:
            # Map robustly verifying profile existence recursively via subscription
            entity = event_entity
            sub_id = entity.get("subscription_id") or entity.get("id")
            if not sub_id:
               return Response(status_code=200)
               
            customer_email = entity.get("email")
            sub_details = rzp_client.subscription.fetch(sub_id)
            notes = sub_details.get("notes") or {}
            user_id = notes.get("profile_id")
            actual_rz_plan_id = sub_details.get("plan_id")
            purchased_plan = await _get_plan_by_razorpay_id(db, actual_rz_plan_id)
            if not purchased_plan:
                logger.warning("No local plan mapped for Razorpay plan %s", actual_rz_plan_id)
                return Response(status_code=200)
            
            if not user_id and customer_email:
                user_res = await db.table("profiles").select("id").eq("email", customer_email).execute()
                user_id = user_res.data[0]["id"] if user_res.data else None

            if user_id:
                await _apply_plan_change(db, redis, user_id, purchased_plan, event, sub_id)
                logger.info("Applied Razorpay %s for user %s plan %s", event, user_id, purchased_plan.get("name"))
                         
        except Exception as e:
            logger.error(f"Failed to process Razorpay webhook {event}: {e}")
            if webhook_log_id:
                await db.table("webhook_logs").update({"status": "failed", "error_msg": str(e)}).eq("id", webhook_log_id).execute()
            return Response(status_code=200)

    elif event in {"payment.failed", "subscription.cancelled", "subscription.completed"}:
        try:
            sub_id = event_entity.get("subscription_id") or event_entity.get("id")
            trial_plan = await _get_trial_plan(db)
            if sub_id and trial_plan:
                await db.table("profiles").update({
                    "plan_id": trial_plan["id"],
                    "razorpay_subscription_id": None,
                    "trial_expired": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("razorpay_subscription_id", sub_id).execute()
                logger.info("Downgraded subscription %s after %s", sub_id, event)
        except Exception as e:
            logger.error(f"Failed to process {event} webhook: {e}")
            if webhook_log_id:
                await db.table("webhook_logs").update({"status": "failed", "error_msg": str(e)}).eq("id", webhook_log_id).execute()
            return Response(status_code=200)

    if webhook_log_id:
        try:
            await db.table("webhook_logs").update({"status": "processed"}).eq("id", webhook_log_id).execute()
        except Exception:
            pass
            
    return Response(status_code=200)
