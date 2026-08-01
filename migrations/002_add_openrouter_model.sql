-- =============================================================================
-- Placement Mail Tracker — Add OpenRouter Model Selection
-- =============================================================================
-- Run this in the Supabase SQL Editor to add the model_id column to llm_keys.
-- =============================================================================

ALTER TABLE public.llm_keys
    ADD COLUMN model_id text DEFAULT NULL;

-- Comment on column usage
COMMENT ON COLUMN public.llm_keys.model_id IS 'Only used when provider = openrouter; stores the specific model ID to request.';
