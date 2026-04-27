from supabase import AClient
from fastapi import HTTPException

async def get_strict_plan(user_id: str, db: AClient) -> dict:
    """
    Secure interceptor that mathematically guarantees a plan wrapper.
    If the user's plan is null, it forcefully binds them to the 'free' constraints natively.
    """
    plan_res = await db.table("profiles").select("plan_id, monthly_message_count, plans(*)").eq("id", user_id).single().execute()
    profile = plan_res.data if plan_res else {}
    
    plan = profile.get("plans") if profile else None
    
    if not plan:
        # User lacks a plan! Map mathematically to Free tier constraints
        free_plan_res = await db.table("plans").select("*").eq("name", "free").single().execute()
        if free_plan_res.data:
            plan = free_plan_res.data
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
