import math
from datetime import datetime, timezone, timedelta
from ingestion.embedder import embed_chunks
import logging
import numpy as np

logger = logging.getLogger(__name__)

async def init_topic_embeddings():
    pass

async def compute_suggestions(bot_id: str, db) -> None:
    """
    Runs weekly. Parses the previous 7 days of DB conversation arrays without LLM queries.
    Utilizes Native DB + Array tracking algorithms to replace Supabase nested PostgreSQL limits.
    """
    try:
        now_dt = datetime.now(timezone.utc)
        week_start = now_dt - timedelta(days=7)
        
        # 1. Pull bot fallback sequence limits
        bot_res = await db.table("bot_settings").select("fallback_message").eq("bot_id", bot_id).single().execute()
        if not bot_res.data:
            return
            
        settings_dict = bot_res.data or {}
        fallback_msg = settings_dict.get("fallback_message", "I couldn't find an answer in my knowledge base.")
        if not fallback_msg:
            return

        # 2. Extract relative conversation IDs natively
        c_res = await db.table("conversations").select("id").eq("bot_id", bot_id).gte("created_at", week_start.isoformat()).execute()
        if not c_res.data:
            return
            
        c_ids = [c["id"] for c in c_res.data]
        if not c_ids:
            return

        # 3. Natively filter only the fallback responses first to avoid OOM
        fallback_res = await db.table("messages")\
            .select("id, conversation_id, created_at")\
            .eq("role", "assistant")\
            .ilike("content", f"%{fallback_msg}%")\
            .in_("conversation_id", c_ids)\
            .execute()
            
        # 4. Fetch only the preceding user messages to map conversational state
        unanswered_qs = []
        for fb_msg in (fallback_res.data or []):
            user_msg_res = await db.table("messages")\
                .select("content")\
                .eq("conversation_id", fb_msg["conversation_id"])\
                .eq("role", "user")\
                .lt("created_at", fb_msg["created_at"])\
                .order("created_at", desc=True)\
                .limit(1)\
                .execute()
                
            if user_msg_res.data:
                unanswered_qs.append(user_msg_res.data[0]["content"])

        unique_questions = list(set(unanswered_qs))
        if not unique_questions:
            return

        # 5. Emit bulk embedding chunk pipeline
        embeddings = await embed_chunks(unique_questions)
        if not embeddings or len(embeddings) != len(unique_questions):
            return

        # 6. Apply highly optimized O(1) vectorized matrix clustering
        # Convert embeddings to a 2D numpy array (e.g., shape N x 768)
        emb_matrix = np.array(embeddings)
        
        # Normalize vectors for instantaneous cosine similarity via dot product
        norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1e-10 # Prevent division by zero
        normalized_matrix = emb_matrix / norms
        
        # Calculate full N x N similarity matrix instantly in C++ using BLAS
        similarity_matrix = np.dot(normalized_matrix, normalized_matrix.T)
        
        clusters = []
        assigned = set()
        num_q = len(unique_questions)
        
        for i in range(num_q):
            if i in assigned:
                continue
                
            # Find all indices where similarity > 0.82
            similar_indices = np.where(similarity_matrix[i] > 0.82)[0]
            
            cluster_list = []
            for j in similar_indices:
                if j not in assigned:
                    cluster_list.append(unique_questions[j])
                    assigned.add(j)
                    
            if cluster_list:
                clusters.append(cluster_list)

        # 7. Upsert results algorithmically bounds
        for cluster in clusters:
            if len(cluster) > 1:
                representative = cluster[0]
                
                # Check duplication over the unique week bound string manually if strict constraint handling differs
                # Postgrest upsert approach
                await db.table("suggestions").upsert({
                    "bot_id": bot_id,
                    "question": representative,
                    "frequency": len(cluster),
                    "sample_questions": cluster[:5], # Store list mapping up to 5 elements globally
                    "week_start": week_start.date().isoformat(),
                    "status": "pending"
                }, on_conflict="bot_id,question,week_start").execute()
                
    except Exception as e:
        logger.error(f"Failed suggestion compute pipeline for {bot_id}: {str(e)}")

