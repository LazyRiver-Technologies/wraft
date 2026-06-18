import asyncio
import sys
import json
sys.path.append('backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from database import get_db

async def main():
    db = await get_db()
    res = await db.table('bots').select('id, name, slug, bot_settings(*)').execute()
    for row in res.data:
        settings_list = row.get('bot_settings') or []
        settings = settings_list[0] if isinstance(settings_list, list) and settings_list else settings_list
        if isinstance(settings, dict):
            model = settings.get('model')
            gen_model = settings.get('generation_model')
            print(f"Bot {row['slug']}: model={model}, generation_model={gen_model}")
        else:
            print(f"Bot {row['slug']}: NO SETTINGS")

asyncio.run(main())
