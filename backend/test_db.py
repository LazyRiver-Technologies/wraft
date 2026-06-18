import asyncio
from database import get_db

async def test():
    db = await get_db()
    res = await db.table("plans").select("*").execute()
    print("PLANS:", res.data)
    res2 = await db.table("plan_features").select("*").execute()
    print("PLAN FEATURES:", res2.data)

asyncio.run(test())
