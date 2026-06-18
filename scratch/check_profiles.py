import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.append('backend')
load_dotenv('backend/.env')

from config import settings
from database import get_db

async def main():
    db = await get_db()
    res = await db.table('profiles').select('*').limit(1).execute()
    if res.data:
        print(list(res.data[0].keys()))
    else:
        print("No data")

asyncio.run(main())
