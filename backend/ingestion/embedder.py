import asyncio
import logging
import google.generativeai as genai
from typing import List
from config import settings

logger = logging.getLogger(__name__)

class EmbeddingError(Exception):
    pass

def setup_genai():
    genai.configure(api_key=settings.GEMINI_API_KEY)

async def embed_chunks(texts: List[str]) -> List[List[float]]:
    """
    Embeds text chunks using Google Generative AI (Gemini).
    Processes in batches of 100 texts per request.
    Includes explicit retry logic: 3 retries with 2s exponential backoff.
    """
    if not texts:
        return []

    setup_genai()
    
    # Using specific embedding model universally matched to Google Gemini Developer Keys
    import re
    model = "models/gemini-embedding-001"
    batch_size = 50  # Smaller batch size to stay safely within per-request token/RPM boundaries
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        max_retries = 5
        backoff_sec = 3
        
        batch_embeddings = []
        for attempt in range(max_retries):
            try:
                response = await asyncio.to_thread(
                    genai.embed_content,
                    model=model,
                    content=batch,
                    task_type="retrieval_document",
                    output_dimensionality=768
                )
                
                emb_data = response.get('embedding')
                if not emb_data:
                     raise EmbeddingError("No embedding returned in response")
                     
                batch_embeddings = emb_data
                break
                
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Embedding batch attempt {attempt + 1} failed: {err_str}")
                if attempt == max_retries - 1:
                    raise EmbeddingError(f"Failed to embed chunks after {max_retries} attempts. Last error: {err_str}")
                
                # Switch model immediately on 429
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    model = "models/gemini-embedding-2" if model == "models/gemini-embedding-001" else "models/gemini-embedding-001"
                    if attempt == 0:
                        await asyncio.sleep(0.5)
                        continue
                        
                    delay_match = re.search(r"retry in (\d+(?:\.\d+)?)s", err_str, re.IGNORECASE)
                    if delay_match:
                        sleep_time = max(float(delay_match.group(1)) + 1.5, 6.0)
                    else:
                        sleep_time = 14.0
                else:
                    sleep_time = backoff_sec
                    
                await asyncio.sleep(sleep_time)
                backoff_sec = min(backoff_sec * 2, 30)

        all_embeddings.extend(batch_embeddings)

    return all_embeddings


async def embed_query(text: str) -> List[float]:
    """
    Ultra-low latency single-query embedding designed specifically for user queries.
    Uses task_type="retrieval_query" and attempts immediate zero-wait model failover.
    """
    if not text or not text.strip():
        return []
        
    setup_genai()
    
    models = ["models/gemini-embedding-2", "models/gemini-embedding-001"]
    for m in models:
        try:
            response = await asyncio.to_thread(
                genai.embed_content,
                model=m,
                content=text.strip(),
                task_type="retrieval_query",
                output_dimensionality=768
            )
            emb = response.get('embedding')
            if emb:
                return emb
        except Exception as e:
            logger.warning(f"embed_query failed on {m}: {e}. Trying alternate model immediately...")
            
    # Brief fallback retry
    await asyncio.sleep(1.0)
    for m in reversed(models):
        try:
            response = await asyncio.to_thread(
                genai.embed_content,
                model=m,
                content=text.strip(),
                task_type="retrieval_query",
                output_dimensionality=768
            )
            emb = response.get('embedding')
            if emb:
                return emb
        except Exception:
            pass
            
    return []
