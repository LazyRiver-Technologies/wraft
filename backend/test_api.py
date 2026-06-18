import asyncio
from database import get_db
from repositories.analytics_repository import AnalyticsRepository
from services.analytics_service import AnalyticsService

async def test():
    db = await get_db()
    repo = AnalyticsRepository(db)
    service = AnalyticsService(repo)
    res = await db.table("profiles").select("id").limit(1).execute()
    if res.data:
        owner_id = res.data[0]["id"]
        bot_ids = await repo.get_bot_ids_for_owner(owner_id)
        overview = await service.get_overview(owner_id, bot_ids, None, None, "all")
        print("OVERVIEW:", overview)
    else:
        print("No profiles found")

asyncio.run(test())
