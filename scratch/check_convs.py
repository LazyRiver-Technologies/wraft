import asyncio
import sys
sys.path.append('backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from database import get_db

async def main():
    db = await get_db()
    res = await db.table('conversations').select('*').limit(5).execute()
    if res.data:
        for c in res.data:
            print(c['id'], c['message_count'])
    else:
        print("No conversations found")

asyncio.run(main())
