import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def run_migration():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("""
            create table if not exists playground_shares (
              id uuid primary key default uuid_generate_v4(),
              bot_id uuid references bots(id) on delete cascade,
              token text unique not null,
              created_at timestamptz default now(),
              expires_at timestamptz not null
            );
            create index if not exists idx_playground_token on playground_shares(token);
        """)
        print("Migration successful")
    finally:
        await conn.close()

asyncio.run(run_migration())
