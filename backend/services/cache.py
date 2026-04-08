import json
import time
import math
from uuid import uuid4
from ingestion.embedder import embed_chunks

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

async def get_cached_response(question: str, bot_id: str, redis) -> str | None:
    """
    Scans the redis semantic cache looking for geometrically similar cached matches.
    """
    try:
        query_embeddings = await embed_chunks([question])
        if not query_embeddings:
            return None
            
        query_emb = query_embeddings[0]
        prefix = f"cache:{bot_id}:"
        
        # In a massive dataset scanning redis is slow, but assuming short caches per bot it is OK.
        # Alternatively, redis-search vector could be used if configured. We'll implement SCAN.
        cursor = 0
        best_match = None
        best_score = -1.0
        
        while True:
            cursor, keys = await redis.scan(cursor, match=f"{prefix}*", count=100)
            
            for key in keys:
                cached_data = await redis.hgetall(key)
                if not cached_data or 'embedding' not in cached_data:
                    continue
                    
                cached_emb = json.loads(cached_data['embedding'])
                score = cosine_similarity(query_emb, cached_emb)
                
                if score > best_score:
                    best_score = score
                    best_match = cached_data.get('response')
            
            if cursor == 0:
                break
                
        if best_score > 0.92 and best_match:
            return best_match
            
    except Exception as e:
        # Failsafe cache miss if errors occur
        import logging
        logging.getLogger(__name__).warning(f"Cache check failed: {e}")
        
    return None

async def store_cached_response(question: str, bot_id: str, response: str, redis) -> None:
    """
    Stores an exact AI response into the semantic cache payload.
    """
    try:
        embeddings = await embed_chunks([question])
        if not embeddings:
            return
            
        emb_json = json.dumps(embeddings[0])
        key = f"cache:{bot_id}:{uuid4()}"
        
        data = {
            "embedding": emb_json,
            "response": response,
            "created_at": str(time.time())
        }
        
        await redis.hset(key, mapping=data)
        await redis.expire(key, 3600)  # 1 hour TTL
        
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Cache store failed: {e}")
