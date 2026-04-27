import asyncio
from database import get_db

async def main():
    db = await get_db()
    res = await db.table("playground_shares").select("*").limit(1).execute()
    print(res.data)

asyncio.run(main())
