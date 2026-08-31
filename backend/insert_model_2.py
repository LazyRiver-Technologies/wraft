import asyncio
from config import settings
from supabase import acreate_client

async def main():
    db = await acreate_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    
    await db.table("embedding_models").upsert({
        "provider": "gemini",
        "model": "gemini-embedding-2",
        "dimensions": 768,
        "is_active": True,
        "notes": "Google Gemini embedding model 2."
    }).execute()
    print("Inserted model successfully.")

asyncio.run(main())
