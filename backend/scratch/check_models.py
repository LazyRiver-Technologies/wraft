import asyncio
from config import settings
from supabase import acreate_client

async def main():
    db = await acreate_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    
    res = await db.table("embedding_models").select("*").execute()
    print("Embedding Models:")
    for m in res.data:
        print(m)

asyncio.run(main())
