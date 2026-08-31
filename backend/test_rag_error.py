import asyncio
from services.rag import get_rag_response
from unittest.mock import AsyncMock

async def main():
    db = AsyncMock()
    # match_chunks
    rpc_mock = AsyncMock()
    rpc_mock.execute.return_value = type('obj', (), {'data': []})()
    db.rpc.return_value = rpc_mock
    
    # data_sources
    table_mock = AsyncMock()
    table_mock.select().in_().execute.return_value = type('obj', (), {'data': []})()
    db.table.return_value = table_mock
    
    redis = AsyncMock()
    redis.get.return_value = None
    
    res = await get_rag_response(
        question="hello",
        bot_id="123",
        bot_settings={"model": "gemini-3.7-flash"},
        conversation_history=[],
        owner_id="owner",
        channel="web",
        db=db,
        redis=redis,
        bot_name="test"
    )
    print(res)

asyncio.run(main())
