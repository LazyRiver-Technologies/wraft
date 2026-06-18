import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return
        
    conn = await asyncpg.connect(db_url)
    try:
        # Check current columns of whatsapp_configs
        cols = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_configs'")
        for col in cols:
            print(col['column_name'], col['data_type'])
            
        print("--- Modifying table ---")
        # Try to rename access_token_secret_id to access_token_enc and change type to text
        try:
            await conn.execute("ALTER TABLE whatsapp_configs RENAME COLUMN access_token_secret_id TO access_token_enc")
            print("Renamed access_token_secret_id to access_token_enc")
        except asyncpg.exceptions.UndefinedColumnError:
            print("access_token_secret_id column does not exist or already renamed")
            
        try:
            await conn.execute("ALTER TABLE whatsapp_configs ALTER COLUMN access_token_enc TYPE text USING access_token_enc::text")
            print("Changed access_token_enc to text")
        except asyncpg.exceptions.UndefinedColumnError:
            print("access_token_enc column does not exist")
            
    finally:
        await conn.close()

asyncio.run(main())
