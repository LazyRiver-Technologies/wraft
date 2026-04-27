import json
import time
import uuid
import numpy as np
import logging
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_SIMILARITY_THRESHOLD = 0.88
CACHE_TTL_SECONDS = 3600  # 1 hour

def cosine_similarity(a: list, b: list) -> float:
    arr_a = np.array(a)
    arr_b = np.array(b)
    norm_a = np.linalg.norm(arr_a)
    norm_b = np.linalg.norm(arr_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))

async def get_cached_response(
    question: str,
    bot_id: str,
    question_embedding: list,
    redis
) -> Optional[str]:
    """
    Check if a semantically similar question was already 
    answered for this bot.
    
    Takes pre-computed embedding — no extra API call needed
    since caller already embeds the question for RAG.
    """
    if redis is None:
        return None
    
    try:
        # scan all cache keys for this bot
        pattern = f"cache:{bot_id}:*"
        keys = []
        async for key in redis.scan_iter(pattern, count=100):
            keys.append(key)
        
        if not keys:
            return None
        
        # fetch all cached entries for this bot
        pipe = redis.pipeline()
        for key in keys:
            pipe.get(key)
        values = await pipe.execute()
        
        best_sim = 0.0
        best_response = None
        
        for value in values:
            if not value:
                continue
            try:
                entry = json.loads(value)
                cached_embedding = entry.get("embedding")
                cached_response = entry.get("response")
                
                if not cached_embedding or not cached_response:
                    continue
                
                sim = cosine_similarity(
                    question_embedding, 
                    cached_embedding
                )
                
                if sim > best_sim:
                    best_sim = sim
                    best_response = cached_response
                    
            except (json.JSONDecodeError, Exception):
                continue
        
        if best_sim >= CACHE_SIMILARITY_THRESHOLD:
            logger.info(
                f"Cache HIT bot={bot_id} "
                f"similarity={best_sim:.3f}"
            )
            return best_response
        
        logger.info(
            f"Cache MISS bot={bot_id} "
            f"best_similarity={best_sim:.3f}"
        )
        return None
        
    except Exception as e:
        logger.warning(f"Cache get failed: {e}")
        return None

async def store_cached_response(
    bot_id: str,
    question_embedding: list,
    response: str,
    redis
) -> None:
    """
    Store a question embedding + response in Redis.
    TTL: 1 hour.
    """
    if redis is None:
        return
    
    try:
        key = f"cache:{bot_id}:{uuid.uuid4()}"
        entry = json.dumps({
            "embedding": question_embedding,
            "response": response,
            "created_at": int(time.time())
        })
        await redis.setex(key, CACHE_TTL_SECONDS, entry)
        logger.info(f"Cache STORED bot={bot_id}")
        
    except Exception as e:
        logger.warning(f"Cache store failed: {e}")

async def invalidate_bot_cache(bot_id: str, redis) -> None:
    """
    Clear all cached responses for a bot.
    Call this when client updates data sources.
    """
    if redis is None:
        return
    try:
        pattern = f"cache:{bot_id}:*"
        async for key in redis.scan_iter(pattern):
            await redis.delete(key)
        logger.info(f"Cache invalidated for bot={bot_id}")
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
