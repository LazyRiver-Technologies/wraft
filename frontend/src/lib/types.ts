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
  chunk_count?: number
  message_count?: number
  lead_count?: number
}

export interface BotSettings {
  system_prompt?: string
  model?: string
  temperature?: number
  max_chunks?: number
  fallback_message?: string
  owner_whatsapp?: string
  notify_on_lead?: boolean
  notify_on_fallback?: boolean
  notify_on_escalation?: boolean
  acronym_map?: Record<string, string>
  guardrails_enabled?: boolean
  search_mode?: 'hybrid' | 'vector'
}

export interface BotAppearance {
  theme_color: string
  welcome_message: string
  placeholder_text: string
  position: 'bottom-left' | 'bottom-right'
}

export interface WhatsAppConfig {
  id: string
  phone_number_id: string
  business_account_id: string
  access_token: string
  verified_number?: string
  verify_token?: string
  is_active: boolean
}

export interface Lead {
  id: string
  bot_id: string
  name: string | null
  email: string | null
  phone: string | null
  source: string
  is_contacted: boolean
  message_preview: string | null
  created_at: string
}

export interface DataSource {
  id: string
  bot_id: string
  name: string
  type: 'pdf' | 'url' | 'sitemap' | 'text'
  status: 'processing' | 'ready' | 'failed'
  chunk_count: number
  error?: string
  auto_retrain: boolean
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
}

export interface Suggestion {
  id: string
  bot_id: string
  question: string
  frequency: number
  sample_questions: string[]
  status: 'pending' | 'added_qa' | 'dismissed'
  created_at: string
}
