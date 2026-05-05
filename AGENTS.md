database schema for wraft :-

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  action text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['widget_open'::text, 'widget_close'::text, 'message_sent'::text, 'message_received'::text, 'drop_off'::text, 'source_click'::text, 'conversation_start'::text, 'conversation_end'::text, 'whatsapp_opt_in'::text])),
  channel text NOT NULL DEFAULT 'web'::text CHECK (channel = ANY (ARRAY['web'::text, 'whatsapp'::text])),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_events_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  message text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp'::text CHECK (channel = ANY (ARRAY['whatsapp'::text, 'in_app'::text, 'both'::text])),
  target_plans ARRAY NOT NULL DEFAULT '{all}'::text[],
  target_user_ids jsonb,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'sending'::text, 'sent'::text, 'failed'::text])),
  sent_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  key_hash text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'default'::text,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.bot_actions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['notify_owner'::text, 'calculate_quote'::text, 'check_availability'::text])),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bot_actions_pkey PRIMARY KEY (id),
  CONSTRAINT bot_actions_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.bot_appearance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL UNIQUE,
  theme_color text NOT NULL DEFAULT '#6366f1'::text,
  welcome_message text NOT NULL DEFAULT 'Hi! How can I help you?'::text,
  placeholder_text text NOT NULL DEFAULT 'Ask me anything...'::text,
  bot_avatar_url text,
  launcher_icon text NOT NULL DEFAULT 'chat'::text,
  position text NOT NULL DEFAULT 'bottom-right'::text CHECK ("position" = ANY (ARRAY['bottom-right'::text, 'bottom-left'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bot_appearance_pkey PRIMARY KEY (id),
  CONSTRAINT bot_appearance_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.bot_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL UNIQUE,
  system_prompt text NOT NULL DEFAULT 'You are a helpful, friendly assistant.

BEHAVIOR RULES:

1. Answer directly and conversationally. Never use phrases like "based on the provided context", "the context indicates", "according to the information provided", "the context mentions". Just answer naturally as if you already know this information.

2. If the user makes a typo or their message is unclear, intelligently interpret what they meant and answer. For example "is yaseen eligible" and "syaseen eligible" mean the same thing. Always interpret charitably and answer the actual question.

3. Answer confidently when you have the information. Do not hedge with words like "appears to", "seems like", "might be", "possibly" unless you are genuinely unsure.

4. Keep answers short and direct. Do not repeat the question back. Do not add unnecessary filler like "Great question!" or "Certainly!". Just answer.

5. Always respond in the same language the user is writing in. If they write in Hindi, respond in Hindi. If Kannada, respond in Kannada. If Hinglish, respond in Hinglish.

6. If you truly do not have the information, say simply: "I don''t have that information. Please contact us directly." Nothing more.'::text,
  model text NOT NULL DEFAULT 'gemini-2.5-flash-lite'::text,
  temperature double precision NOT NULL DEFAULT 0.3 CHECK (temperature >= 0::double precision AND temperature <= 1::double precision),
  max_chunks integer NOT NULL DEFAULT 5 CHECK (max_chunks >= 1 AND max_chunks <= 20),
  search_mode text NOT NULL DEFAULT 'hybrid'::text CHECK (search_mode = ANY (ARRAY['vector'::text, 'keyword'::text, 'hybrid'::text])),
  fallback_message text NOT NULL DEFAULT 'I could not find an answer to that. Please contact support.'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lead_capture_enabled boolean NOT NULL DEFAULT false,
  lead_capture_trigger integer NOT NULL DEFAULT 2,
  lead_capture_message text NOT NULL DEFAULT 'May I have your name and phone number to follow up?'::text,
  acronym_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  guardrails_enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT bot_settings_pkey PRIMARY KEY (id),
  CONSTRAINT bot_settings_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.bots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT bots_pkey PRIMARY KEY (id),
  CONSTRAINT bots_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversation_topics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  topic text NOT NULL,
  conversation_count integer NOT NULL DEFAULT 0,
  percentage double precision NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT conversation_topics_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_topics_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'web'::text CHECK (channel = ANY (ARRAY['web'::text, 'whatsapp'::text])),
  session_id text NOT NULL,
  end_user_id text,
  end_user_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  quality_score double precision CHECK (quality_score >= 0::double precision AND quality_score <= 1::double precision),
  resolved boolean NOT NULL DEFAULT false,
  resolution_type text CHECK (resolution_type = ANY (ARRAY['answered'::text, 'dropped_off'::text, 'escalated'::text, 'limit_reached'::text])),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.data_sources (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['pdf'::text, 'url'::text, 'text'::text, 'sitemap'::text])),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text])),
  storage_path text,
  source_url text,
  raw_text text,
  chunk_count integer NOT NULL DEFAULT 0,
  file_size_bytes bigint,
  checksum text,
  error_msg text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  auto_retrain boolean NOT NULL DEFAULT false,
  retrain_frequency text DEFAULT 'weekly'::text CHECK (retrain_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])),
  last_retrained_at timestamp with time zone,
  CONSTRAINT data_sources_pkey PRIMARY KEY (id),
  CONSTRAINT data_sources_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.document_chunks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  source_id uuid NOT NULL,
  content text NOT NULL,
  content_tsv tsvector DEFAULT to_tsvector('simple'::regconfig, content),
  embedding USER-DEFINED,
  chunk_index integer NOT NULL,
  token_count integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT document_chunks_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id),
  CONSTRAINT document_chunks_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id)
);
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  flag_name text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  enabled_for text NOT NULL DEFAULT 'all'::text CHECK (enabled_for = ANY (ARRAY['all'::text, 'paid'::text, 'pro_above'::text, 'scale'::text, 'specific'::text])),
  specific_user_ids jsonb DEFAULT '[]'::jsonb,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  conversation_id uuid,
  name text,
  phone text,
  email text,
  city text,
  channel text NOT NULL DEFAULT 'web'::text CHECK (channel = ANY (ARRAY['web'::text, 'whatsapp'::text])),
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_contacted boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id),
  CONSTRAINT leads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  cache_hit boolean NOT NULL DEFAULT false,
  sentiment_score double precision CHECK (sentiment_score >= '-1'::integer::double precision AND sentiment_score <= 1::double precision),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.notification_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL UNIQUE,
  owner_whatsapp text,
  notify_new_lead boolean NOT NULL DEFAULT true,
  notify_fallback boolean NOT NULL DEFAULT true,
  notify_negative_sentiment boolean NOT NULL DEFAULT true,
  notify_escalation boolean NOT NULL DEFAULT true,
  quiet_hours_start integer DEFAULT 23,
  quiet_hours_end integer DEFAULT 8,
  min_interval_minutes integer DEFAULT 5,
  last_notified_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.plan_changes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  old_plan_id uuid,
  new_plan_id uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  CONSTRAINT plan_changes_pkey PRIMARY KEY (id),
  CONSTRAINT plan_changes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT plan_changes_old_plan_id_fkey FOREIGN KEY (old_plan_id) REFERENCES public.plans(id),
  CONSTRAINT plan_changes_new_plan_id_fkey FOREIGN KEY (new_plan_id) REFERENCES public.plans(id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  max_bots integer,
  max_chunks_per_bot integer NOT NULL,
  max_messages_per_month integer NOT NULL,
  max_data_sources_per_bot integer NOT NULL,
  price_inr integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  max_qa_pairs integer DEFAULT 5,
  languages_supported text NOT NULL DEFAULT 'english_only'::text,
  show_watermark boolean NOT NULL DEFAULT true,
  api_access boolean NOT NULL DEFAULT false,
  max_actions integer DEFAULT 0,
  auto_retrain_frequency text,
  remove_watermark boolean NOT NULL DEFAULT false,
  overage_price_paise integer NOT NULL DEFAULT 0,
  lead_capture boolean NOT NULL DEFAULT false,
  wa_notifications boolean NOT NULL DEFAULT false,
  advanced_analytics boolean NOT NULL DEFAULT false,
  leads_export boolean NOT NULL DEFAULT false,
  check_availability boolean NOT NULL DEFAULT false,
  calculate_quote boolean NOT NULL DEFAULT false,
  custom_actions boolean NOT NULL DEFAULT false,
  shareable_playground boolean NOT NULL DEFAULT false,
  custom_branding boolean NOT NULL DEFAULT false,
  custom_domain boolean NOT NULL DEFAULT false,
  white_label boolean NOT NULL DEFAULT false,
  webhook_access boolean NOT NULL DEFAULT false,
  sitemap_source boolean NOT NULL DEFAULT false,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.playground_shares (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'::text) UNIQUE,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playground_shares_pkey PRIMARY KEY (id),
  CONSTRAINT playground_shares_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  plan_id uuid,
  full_name text,
  avatar_url text,
  phone text,
  monthly_message_count integer NOT NULL DEFAULT 0,
  billing_cycle_start date NOT NULL DEFAULT CURRENT_DATE,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  business_name text,
  business_type text CHECK (business_type = ANY (ARRAY['retail'::text, 'healthcare'::text, 'education'::text, 'real_estate'::text, 'food'::text, 'hospitality'::text, 'professional_services'::text, 'local_services'::text, 'saas_tech'::text, 'other'::text])),
  primary_language text DEFAULT 'english'::text CHECK (primary_language = ANY (ARRAY['english'::text, 'hindi'::text, 'kannada'::text, 'hinglish'::text])),
  city text,
  main_use_case text CHECK (main_use_case = ANY (ARRAY['answer_questions'::text, 'capture_leads'::text, 'book_appointments'::text, 'product_discovery'::text, 'all'::text])),
  onboarding_completed boolean NOT NULL DEFAULT false,
  trial_started_at timestamp with time zone DEFAULT now(),
  trial_expired boolean NOT NULL DEFAULT false,
  overage_messages integer NOT NULL DEFAULT 0,
  admin_notes text,
  is_banned boolean NOT NULL DEFAULT false,
  banned_reason text,
  plan_override boolean NOT NULL DEFAULT false,
  trial_extended_days integer NOT NULL DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);
CREATE TABLE public.qa_pairs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  embedding USER-DEFINED,
  is_active boolean NOT NULL DEFAULT true,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qa_pairs_pkey PRIMARY KEY (id),
  CONSTRAINT qa_pairs_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.suggestions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL,
  question text NOT NULL,
  frequency integer NOT NULL DEFAULT 1,
  sample_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'added_qa'::text, 'added_source'::text, 'dismissed'::text])),
  week_start date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT suggestions_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.usage_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  year_month integer NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cache_hits integer NOT NULL DEFAULT 0,
  whatsapp_count integer NOT NULL DEFAULT 0,
  web_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT usage_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp'::text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received'::text CHECK (status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text])),
  error_msg text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);
CREATE TABLE public.whatsapp_configs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bot_id uuid NOT NULL UNIQUE,
  phone_number_id text,
  waba_id text,
  access_token_enc text,
  verify_token text NOT NULL DEFAULT ''::text,
  is_connected boolean NOT NULL DEFAULT false,
  connected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_configs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_configs_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.bots(id)
);