import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from database import get_db
from middleware.auth import get_current_user
from config import settings
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
        
    plan_res = await db.table("plans").select("*").eq("name", plan_name).single().execute()
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    plan = plan_res.data
    rz_plan_id = plan.get("razorpay_plan_id")
    
    # Map securely against statically defined environments if not in DB natively.
    if not rz_plan_id:
        fallback_maps = {
            "Pro": getattr(settings, "RAZORPAY_PRO_PLAN_ID", None),
            "Enterprise": getattr(settings, "RAZORPAY_ENT_PLAN_ID", None)
        }
        rz_plan_id = fallback_maps.get(plan_name)
    
    if not rz_plan_id:
        raise HTTPException(status_code=400, detail="Plan does not have a mapped Razorpay Plan ID")

    try:
        sub = rzp_client.subscription.create({
            "plan_id": rz_plan_id,
            "total_count": 12, # Defaulting 1 year recursion dynamically
            "customer_notify": 1
        })
        
        return {
            "subscription_id": sub["id"],
            "razorpay_key_id": settings.RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def razorpay_webhook(request: Request, db=Depends(get_db)):
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
    
    if event == "payment.captured":
        try:
            # Map robustly verifying profile existence recursively via subscription
            entity = payload["payload"]["payment"]["entity"]
            sub_id = entity.get("subscription_id")
            if not sub_id:
               return Response(status_code=200)
               
            customer_email = entity.get("email")
            
            if customer_email:
                user_res = await db.table("profiles").select("id").eq("email", customer_email).execute()
                if user_res.data:
                    # Fetch the Razorpay Subscription to determine the actual plan purchased
                    sub_details = rzp_client.subscription.fetch(sub_id)
                    actual_rz_plan_id = sub_details.get("plan_id")
                    
                    if actual_rz_plan_id:
                        # Find the matching plan in our DB by razorpay_plan_id
                        purchased_plan = await db.table("plans").select("id").eq("razorpay_plan_id", actual_rz_plan_id).execute()
                        
                        # Fallback to Pro if DB mapping is missing for safety, though it shouldn't be in prod
                        plan_db_id = purchased_plan.data[0]["id"] if purchased_plan.data else None
                        
                        if plan_db_id:
                             await db.table("profiles").update({
                                 "plan_id": plan_db_id,
                                 "razorpay_subscription_id": sub_id
                             }).eq("id", user_res.data[0]["id"]).execute()
                             logger.info(f"Successfully upgraded user {customer_email} to plan {plan_db_id}")
                         
        except Exception as e:
            logger.error(f"Failed to process payment.captured webhook: {e}")

    elif event == "subscription.cancelled":
        try:
            sub_id = payload["payload"]["subscription"]["entity"]["id"]
            free_plan = await db.table("plans").select("id").eq("name", "Free").single().execute()
            if free_plan.data:
                await db.table("profiles").update({
                    "plan_id": free_plan.data["id"],
                    "razorpay_subscription_id": None
                }).eq("razorpay_subscription_id", sub_id).execute()
                logger.info(f"Successfully downgraded subscription {sub_id} to Free plan")
        except Exception as e:
            logger.error(f"Failed to process subscription.cancelled webhook: {e}")
            
    return Response(status_code=200)
