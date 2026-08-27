import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load local environment settings
load_dotenv()
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")

async def run_migration():
    if not DATABASE_URL:
        print("Error: DATABASE_URL environment variable is missing.")
        return
        
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("""
            ALTER TABLE public.conversations 
            ADD COLUMN IF NOT EXISTS workflow_state jsonb DEFAULT '{}'::jsonb;
        """)
        print("Database migration (adding workflow_state) completed successfully!")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
