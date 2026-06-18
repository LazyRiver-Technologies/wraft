import asyncio
from datetime import datetime, timezone
from database import get_db

async def test():
    db = await get_db()
    res = await db.table("profiles").select("*, plans(*)").limit(1).execute()
    profile = res.data[0]
    
    plan_name = profile["plans"]["name"]
    print(f"plan_name: {plan_name}")
    
    trial_days_remaining = 0
    if plan_name == "trial":
        trial_days = 30 + profile.get("trial_extended_days", 0)
        if profile.get("trial_started_at"):
            trial_start = datetime.fromisoformat(
                profile["trial_started_at"].replace("Z", "+00:00")
            )
            now = datetime.now(timezone.utc)
            days_elapsed = (now - trial_start).days
            print(f"trial_start: {trial_start}, now: {now}, elapsed: {days_elapsed}")
            trial_days_remaining = max(0, trial_days - days_elapsed)
        else:
            trial_days_remaining = trial_days
            
        if profile.get("trial_expired"):
            trial_days_remaining = 0
            
    print(f"trial_days_remaining: {trial_days_remaining}")

asyncio.run(test())
