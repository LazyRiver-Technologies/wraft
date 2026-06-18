export interface Bot {
  id: string
  name: string
  slug: string
  is_active: boolean
  owner_id: string
  created_at: string
  updated_at: string
  bot_settings?: BotSettings
  bot_appearance?: BotAppearance
  whatsapp_configs?: WhatsAppConfig[]
  notification_settings?: NotificationSettings[] | NotificationSettings
  chunk_count?: number
  message_count?: number
  lead_count?: number
  conversations?: { count: number }[]
  leads?: { count: number }[]
  usage_logs?: {
    month_start: string
    message_count: number
    total_tokens_in: number
    total_tokens_out: number
    total_cost_paise: number
    cache_hits: number
    whatsapp_count: number
    web_count: number
    overage_count: number
  }[]
  // computed in useBots hook from usage_logs
  this_month?: {
    message_count: number
    web_count: number
    whatsapp_count: number
  }
}

export interface NotificationSettings {
  bot_id?: string
  owner_whatsapp?: string | null
  notify_new_lead?: boolean
  notify_fallback?: boolean
  notify_negative_sentiment?: boolean
  notify_escalation?: boolean
  timezone?: string
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  min_interval_minutes?: number | null
  last_notified_at?: string | null
  updated_at?: string
}

export interface BotSettings {
  system_prompt?: string
  generation_model?: string
  generation_provider?: string
  embedding_provider?: string
  embedding_model?: string
  embedding_dim?: number
  fts_config?: string
  temperature?: number
  max_chunks?: number
  search_mode?: 'hybrid' | 'vector' | 'keyword'
  fallback_message?: string
  lead_capture_enabled?: boolean
  lead_capture_trigger?: number
  lead_capture_message?: string
  acronym_map?: Record<string, string>
  guardrails_enabled?: boolean
  updated_at?: string
}

export interface BotAppearance {
  bot_id?: string
  theme_color: string
  welcome_message: string
  placeholder_text: string
  bot_avatar_url?: string | null
  launcher_icon?: string
  position: 'bottom-left' | 'bottom-right'
  updated_at?: string
}

export interface WhatsAppConfig {
  id: string
  phone_number_id: string | null
  waba_id: string | null
  access_token_secret_id?: string | null
  verify_token?: string
  is_connected: boolean
  connected_at?: string | null
}

export interface Lead {
  id: string
  bot_id: string
  conversation_id?: string | null
  name: string | null
  email: string | null
  phone: string | null
  phone_normalized?: string | null
  city?: string | null
  channel: 'web' | 'whatsapp'
  context?: any[]
  is_contacted: boolean
  contacted_at?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface DataSource {
  id: string
  bot_id: string
  name: string
  type: 'pdf' | 'url' | 'sitemap' | 'text'
  status: 'pending' | 'processing' | 'ready' | 'failed'
  chunk_count: number
  error_msg?: string | null
  storage_path?: string | null
  source_url?: string | null
  raw_text?: string | null
  file_size_bytes?: number | null
  checksum?: string | null
  auto_retrain: boolean
  retrain_frequency?: 'daily' | 'weekly' | 'monthly' | null
  deleted_at?: string | null
  last_retrained_at?: string | null
  created_at: string
  updated_at: string
}

export interface QAPair {
  id: string
  bot_id: string
  question: string
  answer: string
  is_active: boolean
  hit_count: number
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Suggestion {
  id: string
  bot_id: string
  question: string
  frequency: number
  sample_questions: string[]
  status: 'pending' | 'added_qa' | 'dismissed'
  week_start?: string
  created_at: string
}
