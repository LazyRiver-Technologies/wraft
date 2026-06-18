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
    embedding_dim: int,
    db
) -> Optional[str]:
    """
    Check if a semantically similar question was already 
    answered for this bot using Supabase pgvector.
    """
    if db is None:
        return None
    
    try:
        # Fast RPC call to pgvector index
        res = await db.rpc(
            f"match_semantic_cache_{embedding_dim}",
            {
                "query_embedding": question_embedding,
                "match_bot_id": bot_id,
                "match_threshold": CACHE_SIMILARITY_THRESHOLD
            }
        ).execute()

        if res.data and len(res.data) > 0:
            best_match = res.data[0]
            
            # Increment hit count asynchronously
            import asyncio
            async def _update_hit_count():
                try:
                    await db.rpc("increment_cache_hit", {"cache_id": best_match["id"], "dim": embedding_dim}).execute()
                except Exception as e:
                    logger.warning(f"Failed to update cache hit count: {e}")
            
            asyncio.create_task(_update_hit_count())
            
            logger.info(
                f"Cache HIT bot={bot_id} "
                f"similarity={best_match['similarity']:.3f}"
            )
            return best_match["response"]
        
        logger.info(f"Cache MISS bot={bot_id}")
        return None
        
    except Exception as e:
        logger.warning(f"Cache get failed: {e}")
        return None

async def store_cached_response(
    bot_id: str,
    question: str,
    question_embedding: list,
    response: str,
    embedding_dim: int,
    db
) -> None:
    """
    Store a question embedding + response in Supabase.
    """
    if db is None:
        return
    
    try:
        await db.table(f"semantic_cache_{embedding_dim}").insert({
            "bot_id": bot_id,
            "question": question,
            "response": response,
            "embedding": question_embedding
        }).execute()
        logger.info(f"Cache STORED bot={bot_id}")
        
    except Exception as e:
        logger.warning(f"Cache store failed: {e}")

async def invalidate_bot_cache(bot_id: str, embedding_dim: int, db) -> None:
    """
    Clear all cached responses for a bot.
    Call this when client updates data sources.
    """
    if db is None:
        return
    try:
        await db.table(f"semantic_cache_{embedding_dim}").delete().eq("bot_id", bot_id).execute()
        logger.info(f"Cache invalidated for bot={bot_id}")
    except Exception as e:
        logger.warning(f"Cache invalidation failed: {e}")
