import asyncio
from database import get_db
from repositories.analytics_repository import AnalyticsRepository

async def test():
    db = await get_db()
    repo = AnalyticsRepository(db)
    res = await db.table("profiles").select("id").limit(1).execute()
    if res.data:
        owner_id = res.data[0]["id"]
        profile = await repo.get_profile_plan(owner_id)
        print("PROFILE:", profile)
    else:
        print("No profiles found")

asyncio.run(test())
