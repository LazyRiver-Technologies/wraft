import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def check():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Query enum values for embedding_provider
        rows = await conn.fetch("""
            SELECT enumlabel
            FROM pg_enum
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
            WHERE pg_type.typname = 'embedding_provider';
        """)
        print("EMBEDDING PROVIDERS ENUM VALUES:")
        for r in rows:
            print("-", r['enumlabel'])
            
        # Also query column info for bot_settings
        cols = await conn.fetch("""
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'bot_settings';
        """)
        print("\nBOT_SETTINGS COLUMNS:")
        for c in cols:
            print(f"- {c['column_name']}: {c['data_type']} ({c['udt_name']})")
    finally:
        await conn.close()

asyncio.run(check())
