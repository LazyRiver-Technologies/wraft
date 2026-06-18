import asyncio
import sys
sys.path.append('backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from database import get_db

async def main():
    db = await get_db()
    res = await db.table('bots').select('slug').execute()
    print([r['slug'] for r in res.data])

asyncio.run(main())
