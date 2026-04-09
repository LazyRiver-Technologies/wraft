import time
import google.generativeai as genai
from config import settings
from ingestion.embedder import embed_chunks
from services.limits import check_message_limit, increment_usage
from services.cache import get_cached_response, store_cached_response

# Initialize Gemini outside to reuse the client configuration
genai.configure(api_key=settings.GEMINI_API_KEY)

async def get_rag_response(question: str, bot_id: str, bot_settings: dict, conversation_history: list, db, redis) -> dict:
    """
    RAG pipeline:
    1. Checks messaging scale limits
    2. Checks Semantic Cache
    3. Builds Query Embeddings
    4. Matches Context
    5. Calls Google Generative AI
    6. Updates Cache and Logging Usage
    """
    start_time = time.time()
    
    # 1. Limit check. We need owner_id. bot_settings should have owner_id or we fetch owner_id.
    # The prompt passes `bot_settings`, assuming `bot_settings` might have owner_id.
    # Actually, owner_id is in `bots` table. Let's fetch bots to get owner_id if not present.
    owner_res = await db.table("bots").select("owner_id").eq("id", bot_id).single().execute()
    owner_id = owner_res.data["owner_id"] if owner_res.data else None
    if not owner_id:
        raise ValueError("Bot owner not found")
        
    await check_message_limit(owner_id, db)

    # 2. Semantic Cache Check
    cached_resp = await get_cached_response(question, bot_id, redis)
    if cached_resp:
        return {
            "response": cached_resp,
            "cache_hit": True,
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000)
        }

    # 3. Embed Question
    q_embeddings = await embed_chunks([question])
    if not q_embeddings:
        return {"response": "Error configuring embedding model.", "cache_hit": False, "sources": []}
        
    query_embedding = q_embeddings[0]

    # 4. Context Matching
    # Supabase DB function `match_chunks`
    match_count = bot_settings.get("max_chunks", 5)
    search_mode = bot_settings.get("search_mode", "hybrid")
    
    # Passing params strictly matched to defined prompt parameters
    rpc_params = {
        "query_embedding": query_embedding,
        "query_text": question,
        "p_bot_id": bot_id,
        "match_count": match_count,
        "match_threshold": bot_settings.get("match_threshold", 0.5),
        "p_search_mode": search_mode
    }
    
    match_res = await db.rpc("match_chunks", rpc_params).execute()
    chunks = match_res.data or []

    # 5. Empty chunk fallback
    if not chunks:
        fallback = bot_settings.get("fallback_message", "I couldn't find any relevant information to answer your question.")
        return {
            "response": fallback,
            "cache_hit": False,
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000)
        }

    # 6. Build Prompt
    system_prompt = bot_settings.get("system_prompt", "You are a helpful assistant.")
    
    context_str = "\n---\n".join([c.get("content", "") for c in chunks])
    
    history_str = ""
    if conversation_history:
        history_str = "\n".join([f"{'User' if msg.get('role') == 'user' else 'Assistant'}: {msg.get('content', '')}" for msg in conversation_history[-6:]])

    system_part = f"""SYSTEM MESSAGE:
{system_prompt}

Language rule: Detect the language of the user's question and always respond in that exact same language. If the user writes in Hindi (हिंदी), respond fully in Hindi. If the user writes in Kannada (ಕನ್ನಡ), respond fully in Kannada. If English or Hinglish, respond accordingly. Never switch languages unless the user switches first.

CONTEXT:
{context_str}

CONVERSATION HISTORY:
{history_str}"""

    full_prompt = f"""{system_part}

USER QUESTION:
{question}"""

    temperature = bot_settings.get("temperature", 0.7)

    # 7. Call LLM
    import logging
    import asyncio
    import google.api_core.exceptions
    logger = logging.getLogger(__name__)

    selected_model = bot_settings.get("model", "gemini-2.5-flash-lite")

    try:
        if selected_model == "llama-3.1-8b-instant":
            from groq import AsyncGroq
            groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            
            groq_response = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_part},
                    {"role": "user", "content": question}
                ],
                temperature=temperature,
                max_tokens=1024,
            )
            answer_text = groq_response.choices[0].message.content
            tokens_used = groq_response.usage.total_tokens
        else:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(
                    model_name="gemini-2.5-flash-lite",
                    generation_config=genai.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=1024,
                    )
                )
                response = await asyncio.to_thread(
                    model.generate_content,
                    full_prompt
                )
                answer_text = response.text
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                     tokens_used = response.usage_metadata.total_token_count
                else:
                     tokens_used = len(full_prompt) // 4 + len(answer_text) // 4
    
            except (google.api_core.exceptions.ServiceUnavailable, google.api_core.exceptions.InternalServerError, google.api_core.exceptions.DeadlineExceeded) as e:
                logger.warning(f"Gemini unavailable, using Groq fallback: {e}")
                from groq import AsyncGroq
                groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
                
                groq_response = await groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_part},
                        {"role": "user", "content": question}
                    ],
                    temperature=temperature,
                    max_tokens=1024,
                )
                answer_text = groq_response.choices[0].message.content
                tokens_used = groq_response.usage.total_tokens

    except Exception as e:
        logger.error(f"LLM API failure: {e}")
        return {
            "response": "I'm currently experiencing technical difficulties processing your request.",
            "cache_hit": False,
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000)
        }

    # 9. Store in cache
    await store_cached_response(question, bot_id, answer_text, redis)

    # 10. Increment usage profiling
    # Channel should be determined by caller. We default to 'web'.
    await increment_usage(owner_id, bot_id, tokens_used, "web", db)

    source_ids = list(set([c.get("source_id") for c in chunks if c.get("source_id")]))
    
    # Resolve names safely
    sources_data: list[dict] = []
    if source_ids:
        sr_res = await db.table("data_sources").select("id, name").in_("id", source_ids).execute()
        sources_data = sr_res.data or []
        
    resolved_sources = [{"id": s.get("id"), "name": s.get("name")} for s in sources_data]

    # 11. Return schema
    return {
        "response": answer_text,
        "cache_hit": False,
        "sources": resolved_sources,
        "tokens_used": tokens_used,
        "latency_ms": int((time.time() - start_time) * 1000)
    }
