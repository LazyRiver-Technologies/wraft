import asyncio
from database import get_db

async def main():
    db = await get_db()
    res = await db.table("plans").select("id, name, max_messages_per_month").execute()
    print("PLANS:")
    for p in res.data:
        print(f"ID: {p['id']} - Name: {p['name']} - Messages: {p['max_messages_per_month']}")

asyncio.run(main())
