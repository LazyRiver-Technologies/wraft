import asyncio
from database import get_db

async def update_all_models():
    db = await get_db()
    res = await db.table("bot_settings").update({
        "embedding_model": "text-embedding-004",
        "embedding_dim": 768
    }).eq("embedding_model", "gemini-embedding-001").execute()
    print(f"Updated {len(res.data) if res.data else 0} bots.")

asyncio.run(update_all_models())
