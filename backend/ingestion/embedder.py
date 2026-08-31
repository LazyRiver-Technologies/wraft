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
    model = "models/gemini-embedding-2"
    batch_size = 100
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        max_retries = 3
        backoff_sec = 2
        
        batch_embeddings = []
        for attempt in range(max_retries):
            try:
                import asyncio
                response = await asyncio.to_thread(
                    genai.embed_content,
                    model=model,
                    content=batch,
                    task_type="retrieval_document",
                    output_dimensionality=768
                )
                
                # Check response format. genai.embed_content returns a dict 
                # e.g., {'embedding': [[...], [...]]} when batched
                emb_data = response.get('embedding')
                if not emb_data:
                     raise EmbeddingError("No embedding returned in response")
                     
                batch_embeddings = emb_data
                break
                
            except Exception as e:
                logger.warning(f"Embedding batch attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    raise EmbeddingError(f"Failed to embed chunks after {max_retries} attempts. Last error: {str(e)}")
                
                await asyncio.sleep(backoff_sec)
                backoff_sec *= 2  # Exponential backoff (2, 4 seconds)

        all_embeddings.extend(batch_embeddings)

    return all_embeddings
