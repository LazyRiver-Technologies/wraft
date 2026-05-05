from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from middleware.auth import get_current_user
from services.limits import get_profile_with_plan
from datetime import datetime, timezone
import math

router = APIRouter(prefix="/usage", tags=["usage"])

@router.get("/me")
async def get_my_usage(user=Depends(get_current_user), db=Depends(get_db)):
    profile = await get_profile_with_plan(user.id, db)
    plan = profile["plans"]
    
    plan_name = plan["name"]
    messages_used = profile.get("monthly_message_count", 0)
    messages_limit = plan.get("max_messages_per_month", 0)
    
    # Calculate days in cycle roughly based on created_at or default 30
    # A true billing cycle might use stripe/razorpay current_period_end, 
    # but for trial we use trial_started_at.
    days_in_cycle = 30
    trial_days_remaining = 0
    
    if plan_name == "trial" and profile.get("trial_started_at"):
        trial_days = 30 + profile.get("trial_extended_days", 0)
        trial_start = datetime.fromisoformat(
            profile["trial_started_at"].replace("Z", "+00:00")
        )
        now = datetime.now(timezone.utc)
        days_elapsed = (now - trial_start).days
        trial_days_remaining = max(0, trial_days - days_elapsed)
        if profile.get("trial_expired"):
            trial_days_remaining = 0

    overage_messages = profile.get("overage_messages", 0)
    overage_price_paise = plan.get("overage_price_paise", 0)
    overage_cost_inr = (overage_messages * overage_price_paise) / 100.0

    return {
        "plan_name": plan_name,
        "messages_used": messages_used,
        "messages_limit": messages_limit,
        "days_in_cycle": days_in_cycle,
        "trial_days_remaining": trial_days_remaining,
        "overage_messages": overage_messages,
        "overage_cost_inr": overage_cost_inr,
        "billing_cycle_start": profile.get("billing_cycle_start")
    }
