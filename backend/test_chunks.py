import asyncio
from database import get_db

async def run():
    db = await get_db()
    res = await db.table("bots").select("id").ilike("name", "%jhkzxcsdf%").execute()
    bot_id = res.data[0]["id"]
    
    # We must mock the embedding since we can't easily generate it here
    # Actually, we can just query the document_chunks_768 table directly using FTS
    res = await db.table("document_chunks_768").select("content").ilike("content", "%github%").limit(5).execute()
    for i, row in enumerate(res.data):
        print(f"CHUNK {i}:\n{row['content']}\n")

asyncio.run(run())
