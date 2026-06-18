import asyncio
from database import get_db

async def check_ds():
    db = await get_db()
    # Find bot
    res = await db.table("bots").select("id").ilike("name", "%jhkzxcsdf%").execute()
    bot_id = res.data[0]["id"]
    print("Bot ID:", bot_id)
    
    # Check data sources
    ds_res = await db.table("data_sources").select("id, status, error_msg, chunk_count, source_url").eq("bot_id", bot_id).execute()
    print("Data Sources:", ds_res.data)

    # Check chunks table 768
    chunks_res = await db.table("document_chunks_768").select("id, content", count="exact").eq("bot_id", bot_id).limit(1).execute()
    print("Chunks count 768:", chunks_res.count)
    if chunks_res.data:
        print("Sample 768:", chunks_res.data[0]["content"][:100])

asyncio.run(check_ds())
