import redis.asyncio as redis
from config import settings

redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=100,
    decode_responses=True
)

_redis_client = redis.Redis(connection_pool=redis_pool)

async def get_redis() -> redis.Redis:
    return _redis_client
