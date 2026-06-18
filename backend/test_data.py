import asyncio
from database import get_db

async def check_data_sources():
    db = await get_db()
    res = await db.table("data_sources").select("id, type, source, status, num_chunks, created_at").ilike("source", "%pantherclaw%").execute()
    print("DATA SOURCES:", res.data)
    
    # Let's see if there are any chunks for these data sources
    if res.data:
        for ds in res.data:
            source_id = ds["id"]
            chunks_res = await db.table("chunks_768").select("id, content").eq("source_id", source_id).limit(2).execute()
            print(f"CHUNKS FOR {source_id}:", chunks_res.data)

asyncio.run(check_data_sources())
