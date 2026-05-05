-- Production hardening migration for Wraft.
-- Review and run in Supabase SQL Editor. It is intentionally idempotent where possible.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS razorpay_plan_id text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bots_owner_deleted
ON public.bots(owner_id, deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_bot_session
ON public.conversations(bot_id, session_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_sources_bot_status_deleted
ON public.data_sources(bot_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_document_chunks_bot_source
ON public.document_chunks(bot_id, source_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_content_tsv
ON public.document_chunks USING gin(content_tsv);

CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata
ON public.document_chunks USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_leads_bot_created
ON public.leads(bot_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_logs_owner_month
ON public.usage_logs(owner_id, year_month);

CREATE INDEX IF NOT EXISTS idx_analytics_events_bot_time_type
ON public.analytics_events(bot_id, occurred_at DESC, event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_bot_channel_created
ON public.webhook_logs(bot_id, channel, created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_usage_metrics(
  p_owner_id uuid,
  p_bot_id uuid,
  p_tokens integer,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_month integer := to_char(now(), 'YYYYMM')::integer;
BEGIN
  INSERT INTO public.usage_logs (
    owner_id,
    year_month,
    message_count,
    total_tokens,
    cache_hits,
    whatsapp_count,
    web_count,
    updated_at
  )
  VALUES (
    p_owner_id,
    v_year_month,
    1,
    COALESCE(p_tokens, 0),
    CASE WHEN COALESCE(p_tokens, 0) = 0 THEN 1 ELSE 0 END,
    CASE WHEN p_channel = 'whatsapp' THEN 1 ELSE 0 END,
    CASE WHEN p_channel = 'web' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (owner_id, year_month)
  DO UPDATE SET
    message_count = public.usage_logs.message_count + 1,
    total_tokens = public.usage_logs.total_tokens + COALESCE(p_tokens, 0),
    cache_hits = public.usage_logs.cache_hits + CASE WHEN COALESCE(p_tokens, 0) = 0 THEN 1 ELSE 0 END,
    whatsapp_count = public.usage_logs.whatsapp_count + CASE WHEN p_channel = 'whatsapp' THEN 1 ELSE 0 END,
    web_count = public.usage_logs.web_count + CASE WHEN p_channel = 'web' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_profile_message_count(
  p_owner_id uuid,
  p_increment integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.profiles
  SET
    monthly_message_count = monthly_message_count + COALESCE(p_increment, 1),
    updated_at = now()
  WHERE id = p_owner_id
  RETURNING monthly_message_count INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  query_text text,
  p_bot_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.5,
  p_search_mode text DEFAULT 'hybrid'
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_search_mode = 'keyword' THEN
    RETURN QUERY
    SELECT
      dc.id,
      dc.source_id,
      dc.content,
      dc.metadata,
      ts_rank_cd(dc.content_tsv, plainto_tsquery('simple', COALESCE(query_text, '')))::double precision AS similarity
    FROM public.document_chunks dc
    JOIN public.data_sources ds ON ds.id = dc.source_id
    WHERE dc.bot_id = p_bot_id
      AND ds.deleted_at IS NULL
      AND dc.content_tsv @@ plainto_tsquery('simple', COALESCE(query_text, ''))
    ORDER BY similarity DESC
    LIMIT LEAST(GREATEST(match_count, 1), 20);
  ELSIF p_search_mode = 'vector' THEN
    RETURN QUERY
    SELECT
      dc.id,
      dc.source_id,
      dc.content,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding))::double precision AS similarity
    FROM public.document_chunks dc
    JOIN public.data_sources ds ON ds.id = dc.source_id
    WHERE dc.bot_id = p_bot_id
      AND ds.deleted_at IS NULL
      AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT LEAST(GREATEST(match_count, 1), 20);
  ELSE
    RETURN QUERY
    WITH ranked AS (
      SELECT
        dc.id,
        dc.source_id,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding))::double precision AS vector_score,
        CASE
          WHEN COALESCE(query_text, '') = '' THEN 0
          ELSE ts_rank_cd(dc.content_tsv, plainto_tsquery('simple', query_text))::double precision
        END AS keyword_score
      FROM public.document_chunks dc
      JOIN public.data_sources ds ON ds.id = dc.source_id
      WHERE dc.bot_id = p_bot_id
        AND ds.deleted_at IS NULL
    )
    SELECT
      ranked.id,
      ranked.source_id,
      ranked.content,
      ranked.metadata,
      GREATEST(ranked.vector_score, ranked.keyword_score)::double precision AS similarity
    FROM ranked
    WHERE GREATEST(ranked.vector_score, ranked.keyword_score) >= match_threshold
    ORDER BY similarity DESC
    LIMIT LEAST(GREATEST(match_count, 1), 20);
  END IF;
END;
$$;
