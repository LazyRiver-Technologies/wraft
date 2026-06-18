import asyncio
from config import settings
from supabase import acreate_client
from ingestion.pipeline import run_ingestion_pipeline

async def main():
    db = await acreate_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    
    # Get latest pending data source
    res = await db.table("data_sources").select("*").order("created_at", desc=True).limit(1).execute()
    if not res.data:
        print("No data sources found")
        return
        
    ds = res.data[0]
    print(f"Testing pipeline for source {ds['id']}")
    
    # Fake redis client
    class FakeRedis:
        async def set(self, *args, **kwargs): pass
        async def get(self, *args, **kwargs): return None
        async def exists(self, *args, **kwargs): return False
        
    try:
        await run_ingestion_pipeline(ds['id'], db, FakeRedis())
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
