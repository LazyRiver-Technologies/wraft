import asyncio
from database import get_db

async def run():
    db = await get_db()
    
    res = await db.table("bots").select("id").ilike("name", "%jhkzxcsdf%").execute()
    bot_id = res.data[0]["id"]
    
    # Get the latest message for this bot from the bot
    res = await db.table("messages").select("content, role, metadata").eq("bot_id", bot_id).order("created_at", desc=True).limit(5).execute()
    
    for row in res.data:
        print(f"[{row['role']}] {row['content']}")
        print(f"Metadata: {row['metadata']}")
        print("---")

asyncio.run(run())
