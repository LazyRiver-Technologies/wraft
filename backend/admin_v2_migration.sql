-- Admin audit log
create table admin_audit_log (
  id           uuid primary key default uuid_generate_v4(),
  action       text not null,
  target_id    text,
  details      jsonb not null default '{}',
  performed_at timestamptz not null default now()
);
create index idx_audit_log_time 
  on admin_audit_log(performed_at desc);

-- Admin notes on users
alter table profiles
  add column if not exists admin_notes text,
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists plan_override boolean not null default false,
  add column if not exists trial_extended_days int not null default 0;

-- Feature flags table
create table feature_flags (
  id          uuid primary key default uuid_generate_v4(),
  flag_name   text not null unique,
  is_enabled  boolean not null default true,
  enabled_for text not null default 'all'
    check (enabled_for in ('all', 'paid', 'pro_above', 'scale', 'specific')),
  specific_user_ids jsonb default '[]',
  description text,
  updated_at  timestamptz not null default now()
);

-- Seed default feature flags
insert into feature_flags (flag_name, is_enabled, enabled_for, description) values
  ('whatsapp_agent', true, 'all', 'WhatsApp channel for bots'),
  ('ai_actions', true, 'pro_above', 'AI function calling actions'),
  ('voice_messages', false, 'all', 'WhatsApp voice message support'),
  ('advanced_analytics', true, 'paid', 'Topics, sentiment, drop-off analytics'),
  ('auto_retrain', true, 'paid', 'Automatic data source retraining'),
  ('semantic_cache', true, 'all', 'Redis semantic response caching'),
  ('guardrails', true, 'all', 'Injection and harmful content detection');

-- Announcements
create table announcements (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  message      text not null,
  channel      text not null default 'whatsapp'
    check (channel in ('whatsapp', 'in_app', 'both')),
  target_plans text[] not null default '{all}',
  target_user_ids jsonb default null,
  status       text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_count   int not null default 0,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
