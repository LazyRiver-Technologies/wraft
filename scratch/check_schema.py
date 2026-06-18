import asyncio
import sys
sys.path.append('backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from database import get_db

async def main():
    db = await get_db()
    # Execute raw SQL to get column definition for bot_settings.generation_model
    try:
        res = await db.rpc('get_bot_settings_schema', {}).execute()
        print(res.data)
    except Exception as e:
        print(e)
        pass

asyncio.run(main())
