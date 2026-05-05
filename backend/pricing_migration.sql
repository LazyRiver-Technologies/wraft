-- Add new columns to plans table first
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS max_qa_pairs int default 5,
ADD COLUMN IF NOT EXISTS languages_supported text 
  not null default 'english_only',
ADD COLUMN IF NOT EXISTS show_watermark boolean 
  not null default true,
ADD COLUMN IF NOT EXISTS api_access boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS max_actions int default 0,
ADD COLUMN IF NOT EXISTS auto_retrain_frequency text 
  default null,
ADD COLUMN IF NOT EXISTS remove_watermark boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS overage_price_paise int 
  not null default 0,
ADD COLUMN IF NOT EXISTS lead_capture boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS wa_notifications boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS advanced_analytics boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS leads_export boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS check_availability boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS calculate_quote boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS custom_actions boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS shareable_playground boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS custom_branding boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS custom_domain boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS white_label boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS webhook_access boolean 
  not null default false,
ADD COLUMN IF NOT EXISTS sitemap_source boolean 
  not null default false;

-- Clear existing plans and reinsert correctly
DELETE FROM plans;

INSERT INTO plans (
  name,
  max_bots,
  max_chunks_per_bot,
  max_messages_per_month,
  max_data_sources_per_bot,
  max_qa_pairs,
  languages_supported,
  show_watermark,
  remove_watermark,
  api_access,
  webhook_access,
  max_actions,
  auto_retrain_frequency,
  overage_price_paise,
  lead_capture,
  wa_notifications,
  advanced_analytics,
  leads_export,
  check_availability,
  calculate_quote,
  custom_actions,
  shareable_playground,
  custom_branding,
  custom_domain,
  white_label,
  sitemap_source,
  price_inr
) VALUES

-- TRIAL
(
  'trial',
  1,        -- max_bots
  5000,     -- max_chunks_per_bot
  50,       -- max_messages_per_month
  2,        -- max_data_sources_per_bot
  5,        -- max_qa_pairs
  'english_only',
  true,     -- show_watermark
  false,    -- remove_watermark
  false,    -- api_access
  false,    -- webhook_access
  0,        -- max_actions
  null,     -- auto_retrain_frequency
  0,        -- overage_price_paise
  false,    -- lead_capture
  false,    -- wa_notifications
  false,    -- advanced_analytics
  false,    -- leads_export
  false,    -- check_availability
  false,    -- calculate_quote
  false,    -- custom_actions
  false,    -- shareable_playground
  false,    -- custom_branding
  false,    -- custom_domain
  false,    -- white_label
  false,    -- sitemap_source
  0         -- price_inr
),

-- STARTER
(
  'starter',
  1,        -- max_bots
  20000,    -- max_chunks_per_bot
  2000,     -- max_messages_per_month
  10,       -- max_data_sources_per_bot
  30,       -- max_qa_pairs
  'hindi_kannada_english',
  true,     -- show_watermark
  false,    -- remove_watermark
  false,    -- api_access
  false,    -- webhook_access
  0,        -- max_actions
  null,     -- auto_retrain_frequency
  100,      -- overage_price_paise (₹1 per message)
  true,     -- lead_capture (dashboard only)
  false,    -- wa_notifications
  false,    -- advanced_analytics
  false,    -- leads_export
  false,    -- check_availability
  false,    -- calculate_quote
  false,    -- custom_actions
  true,     -- shareable_playground
  false,    -- custom_branding
  false,    -- custom_domain
  false,    -- white_label
  true,     -- sitemap_source
  999       -- price_inr
),

-- GROWTH
(
  'growth',
  5,        -- max_bots
  50000,    -- max_chunks_per_bot
  5000,     -- max_messages_per_month
  50,       -- max_data_sources_per_bot
  80,       -- max_qa_pairs
  'multilingual_50',
  false,    -- show_watermark
  true,     -- remove_watermark
  false,    -- api_access
  false,    -- webhook_access
  2,        -- max_actions (notify + check availability)
  'weekly', -- auto_retrain_frequency
  100,      -- overage_price_paise
  true,     -- lead_capture
  true,     -- wa_notifications
  true,     -- advanced_analytics
  true,     -- leads_export
  true,     -- check_availability
  false,    -- calculate_quote
  false,    -- custom_actions
  true,     -- shareable_playground
  false,    -- custom_branding
  false,    -- custom_domain
  false,    -- white_label
  true,     -- sitemap_source
  1999      -- price_inr
),

-- SCALE
(
  'scale',
  50,       -- max_bots (customizable — high default)
  200000,   -- max_chunks_per_bot
  15000,    -- max_messages_per_month
  500,      -- max_data_sources_per_bot (customizable)
  500,      -- max_qa_pairs (customizable)
  'multilingual_100',
  false,    -- show_watermark
  true,     -- remove_watermark
  true,     -- api_access
  true,     -- webhook_access
  999,      -- max_actions (effectively unlimited)
  'daily',  -- auto_retrain_frequency
  100,      -- overage_price_paise
  true,     -- lead_capture
  true,     -- wa_notifications
  true,     -- advanced_analytics
  true,     -- leads_export
  true,     -- check_availability
  true,     -- calculate_quote
  true,     -- custom_actions
  true,     -- shareable_playground
  true,     -- custom_branding
  true,     -- custom_domain
  true,     -- white_label
  true,     -- sitemap_source
  4999      -- price_inr
);

-- Add trial tracking to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_started_at 
  timestamptz default now(),
ADD COLUMN IF NOT EXISTS trial_expired 
  boolean not null default false,
ADD COLUMN IF NOT EXISTS overage_messages 
  int not null default 0;

-- Set all existing profiles trial_started_at
UPDATE profiles 
SET trial_started_at = created_at
WHERE trial_started_at IS NULL;
