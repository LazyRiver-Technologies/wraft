import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
conn.autocommit = True
cur = conn.cursor()

dims = [768, 1024, 1536, 3072]
for dim in dims:
    try:
        cur.execute(f"ALTER TABLE public.semantic_cache_{dim} ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;")
        print(f"Added sources to semantic_cache_{dim}")
        
        # We also need to update the match_semantic_cache functions to return sources
        cur.execute(f"""
        CREATE OR REPLACE FUNCTION match_semantic_cache_{dim}(
            query_embedding vector({dim}),
            match_bot_id uuid,
            match_threshold float
        )
        RETURNS TABLE (id uuid, response text, sources jsonb, similarity float) LANGUAGE plpgsql AS $$
        BEGIN
            RETURN QUERY SELECT sc.id, sc.response, sc.sources, 1 - (sc.embedding <=> query_embedding) AS similarity
            FROM public.semantic_cache_{dim} sc
            WHERE sc.bot_id = match_bot_id AND 1 - (sc.embedding <=> query_embedding) > match_threshold
            ORDER BY sc.embedding <=> query_embedding LIMIT 1;
        END;
        $$;
        """)
        print(f"Updated RPC match_semantic_cache_{dim}")
    except Exception as e:
        print(f"Error for {dim}: {e}")

cur.close()
conn.close()
