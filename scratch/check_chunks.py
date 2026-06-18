import asyncio
import sys
sys.path.append('backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from database import get_db

async def main():
    db = await get_db()
    res = await db.table('document_chunks_768').select('id', count='exact').limit(1).execute()
    print('Chunks count:', res.count)
    
    res2 = await db.table('data_sources').select('*').execute()
    print('Sources:', [(s['name'], s['status'], s['error_msg']) for s in res2.data])

asyncio.run(main())
