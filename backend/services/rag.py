import time
import asyncio
from services.admin_events import publish_admin_event
import google.generativeai as genai
import google.api_core.exceptions
from config import settings
from ingestion.embedder import embed_chunks
from services.limits import check_message_limit, increment_usage, get_profile_with_plan
from services.cache import get_cached_response, store_cached_response
from services.actions import get_action_tools, execute_action
from services.notifications import send_owner_notification
import logging
import numpy as np
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Cache up to 1000 bots' QA pairs for 5 minutes to prevent network saturation
import math

def cosine_similarity(v1, v2):
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

async def python_match_chunks(db, bot_id: str, embedding_dim: int, question_embedding: list, match_count: int):
    res = await db.table(f"document_chunks_{embedding_dim}").select("id, content, embedding").eq("bot_id", bot_id).execute()
    chunks = res.data or []
    scored_chunks = []
    for chunk in chunks:
        if not chunk.get("embedding"):
            continue
        emb = chunk["embedding"]
        if isinstance(emb, str):
            import json
            emb = json.loads(emb)
        sim = cosine_similarity(question_embedding, emb)
        scored_chunks.append({
            "id": chunk["id"],
            "content": chunk["content"],
            "similarity": sim
        })
    scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
    return scored_chunks[:match_count]

qa_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)
# --- GUARDRAIL PATTERNS ---

INJECTION_PATTERNS = [
    "ignore previous instructions", "ignore all instructions",
    "forget your instructions", "forget everything",
    "you are now", "act as if", "pretend you are", "pretend to be",
    "system prompt", "jailbreak", "do anything now", "dan",
    "override your", "new instructions", "disregard", "bypass",
    "developer mode",
    # Hindi/Hinglish/Common Indian variations
    "purane instructions bhool jao", "pichla nirdesh bhool jao",
    "ignore karo", "sab bhool jao", "naya nirdesh",
    "pichle nirdesh bhul jao", "sab kuch bhul jao"
]

HARMFUL_PATTERNS = [
    # sexual content
    "porn", "nude", "naked", "sex ", "xxx", "नग्न", "यौन", "ಬೆತ್ತಲೆ", "நிர்வாணம்",
    # violence
    "how to kill", "how to hurt", "bomb", "terrorist", "suicide method",
    "marna", "jaan se maarna", "khoon", "बम", "ಕೊಲೆ", "கொலை",
    # spam/scam
    "send money", "bank account", "otp share", "password share",
    "paise bhejo", "paisa chahiye", "khate me paise", "otp batao"
]

GREETING_PATTERNS = [
    "hi", "hello", "hey", "namaste", "hola", "hi there", "hello there",
    "good morning", "good afternoon", "good evening", "how are you",
    "namaskar", "ram ram", "sat sri akal", "vanakkam", "namaskara",
    "नमस्ते", "नमस्कार", "राम राम", "सत श्री अकाल", "வணக்கம்", "నమస్కారం", "ಹಲೋ"
]

def clean_input(text: str) -> str:
    return text.strip()

def detect_injection(message: str) -> bool:
    lower = message.lower()
    return any(pattern in lower for pattern in INJECTION_PATTERNS)

def contains_harmful_content(message: str) -> bool:
    lower = message.lower()
    return any(term in lower for term in HARMFUL_PATTERNS)

def is_greeting(message: str) -> bool:
    # Check for short messages that are just greetings
    clean = message.lower().strip("?!. ")
    if clean in GREETING_PATTERNS:
        return True
    # Or if it starts with a greeting and is very short
    words = clean.split()
    if words and words[0] in GREETING_PATTERNS and len(words) <= 3:
        return True
    return False

async def is_off_topic(
    question_embedding: list,
    question: str,
    bot_id: str,
    embedding_dim: int,
    db
) -> bool:
    """
    Returns True if question has no relevance to bot's data.
    Uses pre-computed embedding — zero extra API cost.
    Threshold 0.35 — below this the question is unrelated
    to anything in the knowledge base.
    """
    try:
        try:
            chunks = await db.rpc(f"match_chunks_{embedding_dim}", {
                "p_query_embedding": question_embedding,
                "p_query_text": question,
                "p_bot_id": bot_id,
                "p_match_count": 1,
                "p_fts": "english"
            }).execute()
            chunks_data = chunks.data
        except Exception as e:
            if "22000" in str(e) or "dimensions" in str(e) or "match_chunks" in str(e):
                chunks_data = await python_match_chunks(db, bot_id, embedding_dim, question_embedding, 1)
            else:
                raise e
            
        if not chunks_data:
            return True
        
        chunk = chunks_data[0]
            
        # Database might return 'similarity' (cosine) or 'score' (RRF hybrid search)
        # Hybrid search returns BOTH! We must check score first if it's > 0.
        score = chunk.get("score", 0.0)
        RRF_K_CONSTANT = 60
        RRF_THRESHOLD = 0.010 # Roughly rank > 40: 1/(60+40) = 0.01
        COSINE_THRESHOLD = 0.35
        
        if score > 0.0:
            return score < RRF_THRESHOLD
        elif "similarity" in chunk:
            return chunk["similarity"] < COSINE_THRESHOLD
            
        return False # Fallback if unknown format
        
    except Exception as e:
        logger.warning(f"Off-topic check failed: {e}")
        return False  # fail open — better to answer than block

from services.cache_service import get_bot_settings_cached

async def expand_acronyms(question: str, bot_settings: dict) -> str:
    """
    Expands acronyms before embedding.
    Uses client-defined acronym map from bot_settings.
    """
    acronym_map = bot_settings.get("acronym_map", {})
    if not acronym_map:
        return question
    
    # uppercase keys for case-insensitive matching
    acronym_map_upper = {k.upper(): v for k, v in acronym_map.items()}
    
    words = question.split()
    expanded = []
    for word in words:
        # strip punctuation for matching but preserve original
        clean_word = word.upper().strip("?.,!()[]")
        if clean_word in acronym_map_upper:
            expanded.append(acronym_map_upper[clean_word])
        else:
            expanded.append(word)
    
    expanded_question = " ".join(expanded)
    
    # log if expansion happened
    if expanded_question != question:
        logger.info(
            f"Acronym expanded: '{question}' → '{expanded_question}'"
        )
    
    return expanded_question

AMBIGUOUS_TRIGGERS = [
    # pronouns without clear reference
    "he", "she", "they", "it", "this", "that", "these",
    "yeh", "woh", "isko", "usko", "unko", "iske", "uske",
    # vague references  
    "same", "also", "too", "as well", "what about",
    "and him", "and her", "and them",
]

def needs_rewrite(question: str, history: list) -> bool:
    """
    Returns True only when rewriting would actually help.
    Keeps cost to zero for clear questions.
    """
    if not history:
        return False  # no history = nothing to rewrite with
    
    words = question.lower().split()
    
    # very short question with history context
    if len(words) <= 3 and history:
        return True
    
    # contains pronouns that reference previous context
    if any(w in words for w in AMBIGUOUS_TRIGGERS):
        return True
    
    return False

async def rewrite_query(
    question: str,
    history: list,
    bot_id: str
) -> str:
    """
    Makes ambiguous questions self-contained using 
    conversation history. 
    Only called when needs_rewrite() returns True.
    Uses gemini-3.7-flash with max_tokens=50 
    — very cheap, very fast.
    """
    if not needs_rewrite(question, history):
        return question
    
    # use last 3 messages max for context
    recent_history = history[-3:] if len(history) > 3 else history
    history_text = "\n".join([
        f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
        for m in recent_history
    ])
    
    prompt = f"""Conversation so far:
{history_text}

New question: "{question}"

Rewrite the new question to be completely self-contained 
and clear, using context from the conversation.
If the question is already clear, return it unchanged.
Return ONLY the rewritten question. No explanation."""

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                temperature=0,
                max_output_tokens=60,  # very short output
            )
        )
        response = await asyncio.to_thread(
            model.generate_content, prompt
        )
        rewritten = response.text.strip().strip('"')
        
        if rewritten and rewritten != question:
            logger.info(
                f"Query rewritten: '{question}' → '{rewritten}'"
            )
        
        return rewritten if rewritten else question
        
    except Exception as e:
        # never fail the main flow because of rewriting
        logger.warning(f"Query rewrite failed: {e}")
        return question

async def check_qa_pairs(question: str, bot_id: str, bot_settings: dict, db) -> str | None:
    # Check TTLCache first
    pairs = qa_cache.get(bot_id)
    
    embedding_dim = bot_settings.get("embedding_dim", 768)

    if pairs is None:
        # Fetch active Q&A pairs with embeddings pre-loaded
        qa_res = await db.table(f"qa_pairs_{embedding_dim}").select("id, answer, embedding, hit_count").eq("bot_id", bot_id).eq("is_active", True).execute()
        pairs = qa_res.data or []
        qa_cache[bot_id] = pairs
        
    if not pairs:
        return None

    # Embed the incoming user query
    q_embeddings = await embed_chunks([question])
    if not q_embeddings or not q_embeddings[0]:
        return None
        
    query_vec = q_embeddings[0]
    
    best_match = None
    best_score = -1.0
    
    # Mathematical dot product against normalized vectors == cosine similarity
    for p in pairs:
        emb = p.get("embedding")
        # Ensure embedding exists and matches dimension
        if not emb or len(emb) != len(query_vec):
            continue
            
        # Euclidean normalized cosine similarity
        norm_q = np.linalg.norm(query_vec)
        norm_e = np.linalg.norm(emb)
        if norm_q == 0 or norm_e == 0:
            continue
            
        score = np.dot(query_vec, emb) / (norm_q * norm_e)
        if score > best_score:
            best_score = score
            best_match = p
            
    # Deterministic override threshold
    if best_score > 0.92 and best_match:
        # Update hit_count to track conversion effectively
        await db.table(f"qa_pairs_{embedding_dim}").update({"hit_count": best_match.get("hit_count", 0) + 1}).eq("id", best_match["id"]).execute()
        return best_match["answer"]
        
    return None

async def embed_single(text: str) -> list:
    """Helper to embed a single string and return the first element."""
    embeddings = await embed_chunks([text])
    return embeddings[0] if embeddings else []



async def get_rag_response(
    question: str, 
    bot_id: str, 
    bot_settings: dict, 
    conversation_history: list, 
    owner_id: str, 
    channel: str, 
    db, 
    redis,
    bot_name: str = "AI Bot",
    background_tasks=None
) -> dict:
    """
    RAG pipeline:
    1. Checks messaging scale limits
    2. Checks Semantic Cache
    3. Builds Query Embeddings
    4. Matches Context
    5. Calls Google Generative AI
    6. Updates Cache and Logging Usage
    """
    question = clean_input(question)
    start_time = time.time()
    
    business_name = bot_settings.get("business_name", bot_name)
    guardrails_enabled = bot_settings.get("guardrails_enabled", True)

    if guardrails_enabled:
        # GUARDRAIL 1 — Injection detection
        if detect_injection(question):
            logger.warning(
                f"Injection attempt on bot {bot_id}: "
                f"'{question[:100]}'"
            )
            # notify owner about injection attempt
            if background_tasks:
                background_tasks.add_task(
                    send_owner_notification,
                    owner_whatsapp="",
                    notification_type="injection_attempt",
                    data={
                        "bot_name": bot_name,
                        "message": question[:150]
                    },
                    bot_id=bot_id, db=db, redis=redis
                )
            return {
                "response": f"I'm here to help with questions about {business_name} only.",
                "cache_hit": False,
                "source": "guardrail_injection",
                "sources": [],
                "tokens_used": 0,
                "latency_ms": int((time.time() - start_time) * 1000)
            }
        
        # GUARDRAIL 2 — Harmful content
        if contains_harmful_content(question):
            logger.warning(
                f"Harmful content on bot {bot_id}: "
                f"'{question[:100]}'"
            )
            return {
                "response": "I can't help with that. "
                           "Is there something about "
                           f"{business_name} I can help you with?",
                "cache_hit": False,
                "source": "guardrail_harmful",
                "sources": [],
                "tokens_used": 0,
                "latency_ms": int((time.time() - start_time) * 1000)
            }
    
    # Step 0 — Greeting check
    if is_greeting(question):
        return {
            "response": bot_settings.get("welcome_message", f"Hello! How can I help you today?"),
            "cache_hit": False,
            "source": "greeting",
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000)
        }

    # Step 0.5 — Acronym expansion
    question = await expand_acronyms(question, bot_settings)
    
    # Step 0.6 — Query rewrite for ambiguous questions
    question = await rewrite_query(
        question, 
        conversation_history,  # already fetched in chat endpoint
        bot_id
    )
    
    profile = await get_profile_with_plan(owner_id, db)
    plan_data = profile.get("plans", {})
    languages_supported = plan_data.get("languages_supported", "english_only")

    await check_message_limit(owner_id, db)

    # 1.5 Deterministic Q&A Target Override (Zero Cost, Zero Hallucination)
    qa_answer = await check_qa_pairs(question, bot_id, bot_settings, db)
    if qa_answer:
        return {
            "response": qa_answer,
            "cache_hit": False,
            "sources": [{"id": "qa_pair", "name": "Exact Q&A Override"}],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000),
            "confidence_score": 1.0
        }

    # 2. Embed Question ONCE
    question_embedding = await embed_single(question)
    if not question_embedding:
        return {"response": "Error configuring embedding model.", "cache_hit": False, "sources": []}

    embedding_dim = bot_settings.get("embedding_dim", 768)

    if guardrails_enabled:
        # GUARDRAIL 3 — Off-topic check
        # runs AFTER embedding so we reuse the embedding
        # runs AFTER Q&A check so Q&A pairs always work
        off_topic = await is_off_topic(
            question_embedding, question, bot_id, embedding_dim, db
        )
        if off_topic:
            await publish_admin_event("guardrail_trigger", {
                "bot_id": bot_id,
                "type": "offtopic",
                "question_preview": question[:50]
            }, redis)
            return {
                "response": f"I can only answer questions "
                           f"about {business_name}. "
                           f"Is there something specific "
                           f"about us I can help you with?",
                "cache_hit": False,
                "source": "guardrail_offtopic",
                "sources": [],
                "tokens_used": 0,
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    # 3. Semantic Cache Check using embedding
    # BYPASSED FOR NOW TO CLEAR BAD CACHED RESPONSES
    # cached_resp = await get_cached_response(question, bot_id, question_embedding, embedding_dim, db)
    # if cached_resp:
    #     if background_tasks:
    #         background_tasks.add_task(increment_usage, owner_id, bot_id, 0, channel, db)
    #     return {
    #         "response": cached_resp,
    #         "cache_hit": True,
    #         "sources": [{"id": "cache", "name": "Cached RAG Response"}],
    #         "tokens_used": 0,
    #         "latency_ms": int((time.time() - start_time) * 1000),
    #         "confidence_score": 0.99
    #     }

    # 4. Context Matching
    # Supabase DB function `match_chunks_{dim}`
    match_count = bot_settings.get("max_chunks", 5)
    search_mode = bot_settings.get("search_mode", "hybrid")
    
    # Passing params strictly matched to defined prompt parameters
    rpc_params = {
        "p_query_embedding": question_embedding,
        "p_query_text": question,
        "p_bot_id": bot_id,
        "p_match_count": match_count,
        "p_fts": bot_settings.get("fts_config", "english")
    }
    
    try:
        match_res = await db.rpc(f"match_chunks_{embedding_dim}", rpc_params).execute()
        chunks = match_res.data or []
    except Exception as e:
        if "22000" in str(e) or "dimensions" in str(e) or "match_chunks" in str(e):
            logger.warning(f"RPC match_chunks_{embedding_dim} failed. Falling back to Python matching.")
            chunks = await python_match_chunks(db, bot_id, embedding_dim, question_embedding, match_count)
        else:
            raise e
    
    max_similarity = 0.0
    is_rrf = False
    if chunks:
        scores = [c.get("similarity", 0.0) for c in chunks if "similarity" in c]
        if scores:
            max_similarity = max(scores)
        else:
            scores_rrf = [c.get("score", 0.0) for c in chunks if "score" in c]
            if scores_rrf:
                max_similarity = max(scores_rrf)
                is_rrf = True

    # GUARDRAIL 4 — Low confidence / hallucination prevention
    if chunks:
        threshold = 0.015 if is_rrf else 0.45
        with open("debug_log.txt", "a", encoding="utf-8") as f:
            f.write(f"GUARDRAIL 4: max_similarity={max_similarity}, threshold={threshold}, is_rrf={is_rrf}\n")
        if max_similarity < threshold:
            with open("debug_log.txt", "a", encoding="utf-8") as f:
                f.write("GUARDRAIL 4: TRIGGERED!\n")
            fallback = bot_settings.get("fallback_message", "I couldn't find any relevant information to answer your question.")
            return {
                "response": fallback,
                "cache_hit": False,
                "source": "guardrail_low_confidence",
                "sources": [],
                "tokens_used": 0,
                "confidence_score": round(max_similarity, 3),
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    # 5. Empty chunk fallback
    if not chunks:
        fallback = bot_settings.get("fallback_message", "I couldn't find any relevant information to answer your question.")
        return {
            "response": fallback,
            "cache_hit": False,
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000),
            "confidence_score": 0.0
        }

    # 6. Build Prompt
    system_prompt = bot_settings.get("system_prompt", "You are a helpful assistant.")
    
    context_str = "\n---\n".join([c.get("content", "") for c in chunks])
    
    history_str = ""
    if conversation_history:
        history_str = "\n".join([f"{'User' if msg.get('role') == 'user' else 'Assistant'}: {msg.get('content', '')}" for msg in conversation_history[-6:]])

    if languages_supported == 'english_only':
        lang_instruction = """Always respond in English only.
If the user writes in another language, respond:
"I can only communicate in English. Please write in English." """
    elif languages_supported == 'hindi_kannada_english':
        lang_instruction = """Detect the user's language and respond in that language. Supported languages: English, Hindi (हिंदी), Kannada (ಕನ್ನಡ).
If user writes in any other language, respond in English."""
    elif languages_supported == 'multilingual_50':
        lang_instruction = """Detect the user's language and always respond in that exact same language.
Supported: English, Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Gujarati, Punjabi, Malayalam, Urdu, Odia, Assamese, Sanskrit, Maithili, Sindhi, Kashmiri, Konkani, Manipuri, Nepali, and 30+ more Indian and global languages."""
    elif languages_supported == 'multilingual_100':
        lang_instruction = """Detect the user's language and always respond in that exact same language.
You support 100+ languages including all Indian languages, European languages, Arabic, Japanese, Chinese, Korean, and more. Never switch languages unless the user does first."""
    else:
        lang_instruction = "Always respond in English only."

    system_part = f"""SYSTEM MESSAGE:
{system_prompt}

Language rule: {lang_instruction}

CONTEXT:
{context_str}

CONVERSATION HISTORY:
{history_str}"""

    full_prompt = f"""{system_part}

USER QUESTION:
{question}"""

    # Fetch active bot_actions from DB
    from services.limits import check_feature_flag
    
    # Check Feature Flag
    can_use_actions = await check_feature_flag("ai_actions", owner_id, "paid", db, redis)
    
    if can_use_actions:
        bot_actions_res = await db.table("bot_actions").select("*").eq("bot_id", bot_id).eq("is_active", True).execute()
        db_actions = bot_actions_res.data or []
    else:
        db_actions = []
    
    # Map raw tools down into Gemini constraints safely isolated
    tools = get_action_tools(db_actions) if db_actions else []

    temperature = bot_settings.get("temperature", 0.7)

    # 7. Call LLM

    selected_model = bot_settings.get("model", "gemini-2.5-flash")

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
            answer_text = groq_response.choices[0].message.content or ""
            with open("debug_log.txt", "a", encoding="utf-8") as f: f.write(f"LLM Groq OUTPUT: {answer_text}\n")
            tokens_used = groq_response.usage.total_tokens if groq_response.usage else 0
        else:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                
                # Dynamically assign native tools constraints if mapping exists
                generation_provider = bot_settings.get("generation_provider", "google")
                generation_model = bot_settings.get("generation_model", "gemini-2.5-flash")
                
                # Force fallback if needed
                if generation_model == "gpt-4o-mini":
                    generation_model = "gemini-2.5-flash"
                elif not generation_model.startswith("gemini"):
                    generation_model = "gemini-2.5-flash"

                model_params = {
                    "model_name": generation_model,
                    "generation_config": genai.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=1024,
                    )
                }
                if tools:
                    from google.generativeai.types import content_types
                    # Ensure schema is dynamically passed to underlying API
                    model_params["tools"] = tools

                model = genai.GenerativeModel(**model_params)
                
                response = await asyncio.to_thread(
                    model.generate_content,
                    full_prompt
                )
                
                tokens_used = 0
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    tokens_used = response.usage_metadata.total_token_count
                
                # Check for structural explicit function call
                action_triggered = None
                if tools and response.candidates and response.candidates[0].content.parts:
                    has_function_calls = False
                    for part in response.candidates[0].content.parts:
                        if hasattr(part, "function_call") and part.function_call:
                            has_function_calls = True
                            # Parse out specific target call parameters safely
                            fc = part.function_call
                            action_triggered = fc.name
                            fc_args = dict(fc.args) if fc.args else {}
                            
                            # Execute isolated native logic bound mapping
                            action_result = await execute_action(
                                action_type=action_triggered,
                                parameters=fc_args,
                                bot_id=bot_id,
                                bot_actions=db_actions,
                                db=db,
                                redis=redis
                            )
                            
                            # Mutate full_prompt explicitly injecting the functional resolution constraint securely
                            full_prompt += f"\n\n[SYSTEM FUNCTION EXECUTED: '{action_triggered}']\nRESULT:\n{action_result}\n"
                    
                    if has_function_calls:
                        full_prompt += "\nPlease respond to the user based on these exact results."
                        # Re-trigger pipeline
                        followup_response = await asyncio.to_thread(
                            model.generate_content,
                            full_prompt
                        )
                        response = followup_response
                        if hasattr(followup_response, "usage_metadata") and followup_response.usage_metadata:
                            tokens_used += followup_response.usage_metadata.total_token_count

                answer_text = response.text
                with open("debug_log.txt", "a", encoding="utf-8") as f: f.write(f"LLM Gemini OUTPUT: {answer_text}\n")
                if tokens_used == 0:
                     tokens_used = len(question) // 4 + len(answer_text) // 4
    
            except Exception as e:
                if isinstance(e, (google.api_core.exceptions.ServiceUnavailable, google.api_core.exceptions.InternalServerError, google.api_core.exceptions.DeadlineExceeded)):
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
                    answer_text = groq_response.choices[0].message.content or ""
                    tokens_used = groq_response.usage.total_tokens if groq_response.usage else 0
                else:
                    raise e

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"LLM API failure: {e}\n{tb}")
        with open("debug_log.txt", "a", encoding="utf-8") as f:
            f.write(f"LLM EXCEPTION THROWN: {type(e).__name__}: {str(e)}\n{tb}\n")
        return {
            "response": bot_settings.get(
                "fallback_message",
                "I'm currently experiencing technical difficulties. Please try again shortly."
            ),
            "cache_hit": False,
            "source": "llm_error",
            "sources": [],
            "tokens_used": 0,
            "latency_ms": int((time.time() - start_time) * 1000),
            "confidence_score": 0.0
        }

    # 9. Store in cache using background task
    if background_tasks:
        background_tasks.add_task(store_cached_response, bot_id, question, question_embedding, answer_text, embedding_dim, db)

    # 10. Increment usage profiling
    if background_tasks:
        background_tasks.add_task(increment_usage, owner_id, bot_id, tokens_used, channel, db)

    source_ids = list(set([c.get("source_id") for c in chunks if c.get("source_id")]))
    
    # Resolve names safely
    sources_data: list[dict] = []
    if source_ids:
        sr_res = await db.table("data_sources").select("id, name").in_("id", source_ids).execute()
        sources_data = sr_res.data or []
        
    resolved_sources = [{"id": s.get("id"), "name": s.get("name")} for s in sources_data]

    # 11. Return schema safely bounding any action trigger traces natively
    return {
        "response": answer_text,
        "cache_hit": False,
        "sources": resolved_sources,
        "tokens_used": tokens_used,
        "latency_ms": int((time.time() - start_time) * 1000),
        "confidence_score": max_similarity,
        "action_triggered": action_triggered if 'action_triggered' in locals() else None
    }
