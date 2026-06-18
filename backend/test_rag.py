import asyncio
from database import get_db
from services.rag import get_rag_response

async def test_bot():
    db = await get_db()
    
    # get a bot id
    res = await db.table("bots").select("id, owner_id").limit(1).execute()
    if not res.data:
        print("No bots found")
        return
        
    bot_id = res.data[0]["id"]
    owner_id = res.data[0]["owner_id"]
    
    # mock redis and background tasks
    class MockRedis:
        async def publish(self, *args): pass
        
    class MockTasks:
        def add_task(self, *args, **kwargs): pass
    
    # get bot settings
    from services.cache_service import get_bot_settings_cached
    settings = await get_bot_settings_cached(bot_id, db)
    
    resp = await get_rag_response(
        "What is pantherclaw?",
        bot_id=bot_id,
        bot_settings=settings,
        conversation_history=[],
        owner_id=owner_id,
        channel="web",
        db=db,
        redis=MockRedis(),
        background_tasks=MockTasks()
    )
    print("RESPONSE:", resp)

asyncio.run(test_bot())
