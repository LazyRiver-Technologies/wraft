-- Semantic Cache Tables by Dimension

-- 768
CREATE TABLE IF NOT EXISTS public.semantic_cache_768 (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    question text NOT NULL,
    response text NOT NULL,
    embedding vector(768), 
    hit_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_hit_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT semantic_cache_768_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS semantic_cache_768_embedding_idx ON public.semantic_cache_768 USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_semantic_cache_768(
    query_embedding vector(768),
    match_bot_id uuid,
    match_threshold float
)
RETURNS TABLE (id uuid, response text, similarity float) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT sc.id, sc.response, 1 - (sc.embedding <=> query_embedding) AS similarity
    FROM public.semantic_cache_768 sc
    WHERE sc.bot_id = match_bot_id AND 1 - (sc.embedding <=> query_embedding) > match_threshold
    ORDER BY sc.embedding <=> query_embedding LIMIT 1;
END;
$$;


-- 1024
CREATE TABLE IF NOT EXISTS public.semantic_cache_1024 (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    question text NOT NULL,
    response text NOT NULL,
    embedding vector(1024), 
    hit_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_hit_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT semantic_cache_1024_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS semantic_cache_1024_embedding_idx ON public.semantic_cache_1024 USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_semantic_cache_1024(
    query_embedding vector(1024),
    match_bot_id uuid,
    match_threshold float
)
RETURNS TABLE (id uuid, response text, similarity float) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT sc.id, sc.response, 1 - (sc.embedding <=> query_embedding) AS similarity
    FROM public.semantic_cache_1024 sc
    WHERE sc.bot_id = match_bot_id AND 1 - (sc.embedding <=> query_embedding) > match_threshold
    ORDER BY sc.embedding <=> query_embedding LIMIT 1;
END;
$$;


-- 1536
CREATE TABLE IF NOT EXISTS public.semantic_cache_1536 (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    question text NOT NULL,
    response text NOT NULL,
    embedding vector(1536), 
    hit_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_hit_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT semantic_cache_1536_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS semantic_cache_1536_embedding_idx ON public.semantic_cache_1536 USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_semantic_cache_1536(
    query_embedding vector(1536),
    match_bot_id uuid,
    match_threshold float
)
RETURNS TABLE (id uuid, response text, similarity float) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT sc.id, sc.response, 1 - (sc.embedding <=> query_embedding) AS similarity
    FROM public.semantic_cache_1536 sc
    WHERE sc.bot_id = match_bot_id AND 1 - (sc.embedding <=> query_embedding) > match_threshold
    ORDER BY sc.embedding <=> query_embedding LIMIT 1;
END;
$$;


-- 3072
CREATE TABLE IF NOT EXISTS public.semantic_cache_3072 (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    question text NOT NULL,
    response text NOT NULL,
    embedding vector(3072), 
    hit_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_hit_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT semantic_cache_3072_pkey PRIMARY KEY (id)
);
-- pgvector restricts hnsw indexes to 2000 dimensions.
-- Since this is a cache table, exact nearest-neighbor search (sequential scan)
-- will still be extremely fast without an index.

CREATE OR REPLACE FUNCTION match_semantic_cache_3072(
    query_embedding vector(3072),
    match_bot_id uuid,
    match_threshold float
)
RETURNS TABLE (id uuid, response text, similarity float) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT sc.id, sc.response, 1 - (sc.embedding <=> query_embedding) AS similarity
    FROM public.semantic_cache_3072 sc
    WHERE sc.bot_id = match_bot_id AND 1 - (sc.embedding <=> query_embedding) > match_threshold
    ORDER BY sc.embedding <=> query_embedding LIMIT 1;
END;
$$;
