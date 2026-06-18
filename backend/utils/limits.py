from supabase import AClient
from fastapi import HTTPException
from datetime import date

async def get_strict_plan(user_id: str, db: AClient) -> dict:
    """
    Secure interceptor that mathematically guarantees a plan wrapper.
    If the user's plan is null, it forcefully binds them to the 'free' constraints natively.
    """
    plan_res = await db.table("profiles").select("plan_id, monthly_message_count, billing_cycle_start, plans(*, plan_features(*))").eq("id", user_id).limit(1).execute()
    profile = plan_res.data[0] if plan_res.data else {}
    today = date.today()

    cycle_start_raw = profile.get("billing_cycle_start") if profile else None
    if cycle_start_raw:
        try:
            cycle_start = date.fromisoformat(cycle_start_raw)
            if cycle_start.year != today.year or cycle_start.month != today.month:
                await db.table("profiles").update({
                    "monthly_message_count": 0,
                    "billing_cycle_start": today.isoformat(),
                    "overage_messages": 0
                }).eq("id", user_id).execute()
                profile["monthly_message_count"] = 0
                profile["billing_cycle_start"] = today.isoformat()
        except Exception:
            pass
    
    plan = profile.get("plans") if profile else None
    if plan and plan.get("plan_features"):
        for f in plan["plan_features"]:
            plan[f["feature_key"]] = f["feature_value"]
        del plan["plan_features"]
    
    if not plan:
        # User lacks a plan! Map mathematically to Free tier constraints
        free_plan_res = await db.table("plans").select("*, plan_features(*)").eq("name", "free").limit(1).execute()
        if free_plan_res.data:
            plan = free_plan_res.data[0]
            if plan.get("plan_features"):
                for f in plan["plan_features"]:
                    plan[f["feature_key"]] = f["feature_value"]
                del plan["plan_features"]
        else:
            # Complete physical fallback to prevent 500 crashes
            plan = {
                "max_bots": 1,
                "max_chunks_per_bot": 5000,
                "max_messages_per_month": 50,
                "max_data_sources_per_bot": 3
            }
            
    return {
        "plan": plan,
        "monthly_message_count": profile.get("monthly_message_count", 0)
    }
