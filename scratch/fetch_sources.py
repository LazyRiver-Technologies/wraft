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
    res = await db.table('data_sources').select('id, name, type, status, error_msg').execute()
    print(res.data)

asyncio.run(main())
