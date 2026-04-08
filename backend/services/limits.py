from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

async def check_message_limit(owner_id: str, db) -> None:
    """
    Checks if the user has exceeded their messaging limit for the month.
    """
    res = await db.table("profiles").select("monthly_message_count, plans(max_messages_per_month, name)").eq("id", owner_id).single().execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    profile = res.data
    plan = profile.get("plans") 
    
    if not plan:
        return
        
    max_messages = plan.get("max_messages_per_month")
    current_count = profile.get("monthly_message_count") or 0
    
    if max_messages is not None and current_count >= max_messages:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "message_limit_reached",
                "limit": max_messages,
                "plan": plan.get("name", "Unknown Plan")
            }
        )

async def increment_usage(owner_id: str, bot_id: str, tokens: int, channel: str, db) -> None:
    """
    Increments the user usage counters for billing and logs.
    """
    try:
        # Increment profile usage
        res = await db.table("profiles").select("monthly_message_count").eq("id", owner_id).single().execute()
        if res.data:
            current = res.data.get("monthly_message_count") or 0
            await db.table("profiles").update({"monthly_message_count": current + 1}).eq("id", owner_id).execute()
        
        # Log to usage_logs
        await db.table("usage_logs").insert({
            "owner_id": owner_id,
            "bot_id": bot_id,
            "tokens_used": tokens,
            "channel": channel,
            "message_count": 1
        }).execute()
    except Exception as e:
        logger.error(f"Failed to increment usage for owner {owner_id}: {e}")
