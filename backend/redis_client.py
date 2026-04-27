import redis.asyncio as aioredis
from config import settings
import logging

logger = logging.getLogger(__name__)

redis_pool = None

async def init_redis():
    global redis_pool
    try:
        redis_pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=20,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        # test connection
        client = aioredis.Redis(connection_pool=redis_pool)
        await client.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        # don't crash the app — cache just won't work
        redis_pool = None

async def get_redis():
    if redis_pool is None:
        return None
    return aioredis.Redis(connection_pool=redis_pool)

async def close_redis():
    global redis_pool
    if redis_pool:
        await redis_pool.disconnect()
