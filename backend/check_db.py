import asyncio
from database import get_db

async def main():
    try:
        db = await anext(get_db())
        # Check bots table
        bots = await db.table("bots").select("*").order("created_at", desc=True).limit(5).execute()
        print("--- RECENT BOTS ---")
        for b in bots.data:
            print(f"Bot: {b['name']}, Slug: {b['slug']}, Created: {b['created_at']}")
            
        # Check profiles table
        profiles = await db.table("profiles").select("*").limit(1).execute()
        print(f"\n--- PROFILES --- \nCount: {len(profiles.data)}")
        
    except Exception as e:
        print("ERROR:", e)

asyncio.run(main())
