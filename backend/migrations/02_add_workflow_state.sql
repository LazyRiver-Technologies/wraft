-- Migration to add workflow_state to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS workflow_state jsonb DEFAULT '{}'::jsonb;
