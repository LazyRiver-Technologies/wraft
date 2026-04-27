import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def run_migration():
    if not DATABASE_URL:
        print("Error: DATABASE_URL not found.")
        return
        
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. rpc_analytics_overview
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rpc_analytics_overview(
                p_bot_id text, 
                p_start timestamptz, 
                p_end timestamptz, 
                p_channel text
            )
            RETURNS jsonb AS $$
            DECLARE
                v_total_convs int;
                v_total_msgs int;
                v_web_count int;
                v_wa_count int;
                v_total_leads int;
                v_cache_hits int;
                v_tokens_used int;
                v_avg_latency numeric;
            BEGIN
                -- Conversations
                SELECT 
                    COUNT(id), 
                    COALESCE(SUM(message_count), 0),
                    COUNT(id) FILTER (WHERE channel = 'web'),
                    COUNT(id) FILTER (WHERE channel = 'whatsapp')
                INTO 
                    v_total_convs, 
                    v_total_msgs,
                    v_web_count,
                    v_wa_count
                FROM conversations 
                WHERE bot_id = p_bot_id::uuid 
                  AND created_at >= p_start 
                  AND created_at <= p_end
                  AND (p_channel = 'all' OR channel = p_channel);

                -- Messages
                SELECT 
                    COUNT(m.id) FILTER (WHERE m.cache_hit = true),
                    COALESCE(SUM(m.tokens_used), 0),
                    COALESCE(AVG(m.latency_ms), 0)
                INTO 
                    v_cache_hits,
                    v_tokens_used,
                    v_avg_latency
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.bot_id = p_bot_id::uuid
                  AND m.created_at >= p_start 
                  AND m.created_at <= p_end
                  AND (p_channel = 'all' OR c.channel = p_channel);

                -- Leads
                SELECT COUNT(id)
                INTO v_total_leads
                FROM leads
                WHERE bot_id = p_bot_id::uuid;

                RETURN jsonb_build_object(
                    'total_conversations', v_total_convs,
                    'total_messages', v_total_msgs,
                    'avg_messages_per_conversation', CASE WHEN v_total_convs > 0 THEN v_total_msgs::numeric / v_total_convs ELSE 0 END,
                    'cache_hit_rate', CASE WHEN v_total_msgs > 0 THEN v_cache_hits::numeric / v_total_msgs ELSE 0 END,
                    'avg_response_latency_ms', v_avg_latency,
                    'web_vs_whatsapp', jsonb_build_object('web', v_web_count, 'whatsapp', v_wa_count),
                    'tokens_used_this_month', v_tokens_used,
                    'total_leads', v_total_leads
                );
            END;
            $$ LANGUAGE plpgsql;
        """)
        
        # 2. rpc_conversations_over_time
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rpc_conversations_over_time(
                p_bot_id text, 
                p_start timestamptz, 
                p_end timestamptz, 
                p_channel text
            )
            RETURNS jsonb AS $$
            DECLARE
                result jsonb;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object('date', date_str, 'count', count)
                )
                INTO result
                FROM (
                    SELECT 
                        to_char(created_at, 'YYYY-MM-DD') as date_str,
                        COUNT(id) as count
                    FROM conversations
                    WHERE bot_id = p_bot_id::uuid
                      AND created_at >= p_start 
                      AND created_at <= p_end
                      AND (p_channel = 'all' OR channel = p_channel)
                    GROUP BY to_char(created_at, 'YYYY-MM-DD')
                    ORDER BY date_str
                ) t;
                
                RETURN COALESCE(result, '[]'::jsonb);
            END;
            $$ LANGUAGE plpgsql;
        """)

        # 3. rpc_sentiment_over_time
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rpc_sentiment_over_time(
                p_bot_id text, 
                p_start timestamptz, 
                p_end timestamptz, 
                p_channel text
            )
            RETURNS jsonb AS $$
            DECLARE
                result jsonb;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', date_str, 
                        'avg_sentiment', avg_score,
                        'positive', pos_count,
                        'negative', neg_count,
                        'neutral', neut_count
                    )
                )
                INTO result
                FROM (
                    SELECT 
                        to_char(m.created_at, 'YYYY-MM-DD') as date_str,
                        COALESCE(AVG(m.sentiment_score), 0) as avg_score,
                        COUNT(m.id) FILTER (WHERE m.sentiment_score > 0.2) as pos_count,
                        COUNT(m.id) FILTER (WHERE m.sentiment_score < -0.2) as neg_count,
                        COUNT(m.id) FILTER (WHERE m.sentiment_score >= -0.2 AND m.sentiment_score <= 0.2) as neut_count
                    FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.bot_id = p_bot_id::uuid
                      AND m.created_at >= p_start 
                      AND m.created_at <= p_end
                      AND (p_channel = 'all' OR c.channel = p_channel)
                    GROUP BY to_char(m.created_at, 'YYYY-MM-DD')
                    ORDER BY date_str
                ) t;
                
                RETURN COALESCE(result, '[]'::jsonb);
            END;
            $$ LANGUAGE plpgsql;
        """)

        # 4. rpc_top_questions
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rpc_top_questions(
                p_bot_id text, 
                p_start timestamptz, 
                p_end timestamptz, 
                p_channel text
            )
            RETURNS jsonb AS $$
            DECLARE
                result jsonb;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'question_summary', left(content, 100) || CASE WHEN length(content) > 100 THEN '...' ELSE '' END,
                        'count', cluster_count
                    )
                )
                INTO result
                FROM (
                    SELECT 
                        array_to_string((regexp_split_to_array(lower(regexp_replace(content, '[^a-zA-Z0-9 ]', '', 'g')), '\s+'))[1:5], ' ') as key,
                        COUNT(m.id) as cluster_count,
                        MAX(content) as content
                    FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.bot_id = p_bot_id::uuid
                      AND m.role = 'user'
                      AND m.created_at >= p_start 
                      AND m.created_at <= p_end
                      AND (p_channel = 'all' OR c.channel = p_channel)
                    GROUP BY key
                    ORDER BY cluster_count DESC
                    LIMIT 20
                ) t;
                
                RETURN COALESCE(result, '[]'::jsonb);
            END;
            $$ LANGUAGE plpgsql;
        """)

        # 5. rpc_sources_performance
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rpc_sources_performance(
                p_bot_id text, 
                p_start timestamptz, 
                p_end timestamptz, 
                p_channel text
            )
            RETURNS jsonb AS $$
            DECLARE
                result jsonb;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'source_id', s_id,
                        'source_name', COALESCE(ds.name, 'Deleted Source (' || s_id || ')'),
                        'citation_count', citation_count
                    )
                )
                INTO result
                FROM (
                    SELECT 
                        jsonb_array_elements_text(m.sources) as s_id,
                        COUNT(*) as citation_count
                    FROM messages m
                    JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.bot_id = p_bot_id::uuid
                      AND m.created_at >= p_start 
                      AND m.created_at <= p_end
                      AND (p_channel = 'all' OR c.channel = p_channel)
                      AND m.sources IS NOT NULL
                      AND jsonb_typeof(m.sources) = 'array'
                    GROUP BY s_id
                ) t
                LEFT JOIN data_sources ds ON ds.id::text = t.s_id
                ORDER BY citation_count DESC;
                
                RETURN COALESCE(result, '[]'::jsonb);
            END;
            $$ LANGUAGE plpgsql;
        """)

        print("Successfully deployed RPCs to Supabase.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
