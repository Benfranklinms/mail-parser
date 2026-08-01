-- =============================================================================
-- Placement Mail Tracker — Initial Database Schema
-- =============================================================================
-- Run this in the Supabase SQL Editor to set up all tables, enums, and RLS.
-- =============================================================================

-- ========================
-- 1. Custom Enum Types
-- ========================

CREATE TYPE public.role_type_enum AS ENUM (
    'internship',
    'full-time',
    'ppo',
    'unclear'
);

CREATE TYPE public.application_status_enum AS ENUM (
    'not_applied',
    'applied',
    'result_out'
);

CREATE TYPE public.llm_provider_enum AS ENUM (
    'gemini',
    'groq',
    'openrouter'
);

CREATE TYPE public.extraction_method_enum AS ENUM (
    'regex',
    'llm',
    'hybrid'
);


-- ========================
-- 2. Tables
-- ========================

-- Stores encrypted Gmail refresh tokens and sync state per user.
CREATE TABLE public.email_connections (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_refresh_token text NOT NULL,
    gmail_history_id text,
    last_synced_at  timestamptz,
    created_at      timestamptz DEFAULT now() NOT NULL,

    -- One Gmail connection per user
    CONSTRAINT email_connections_user_id_unique UNIQUE (user_id)
);

-- Stores encrypted LLM API keys. One key per user per provider.
CREATE TABLE public.llm_keys (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider        public.llm_provider_enum NOT NULL,
    encrypted_api_key text NOT NULL,
    key_last_four   varchar(4) NOT NULL,
    created_at      timestamptz DEFAULT now() NOT NULL,

    -- One key per provider per user
    CONSTRAINT llm_keys_user_provider_unique UNIQUE (user_id, provider)
);

-- Core table — extracted placement opportunity data.
CREATE TABLE public.opportunities (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company             text,
    role                text,
    role_type           public.role_type_enum DEFAULT 'unclear',
    salary_or_stipend   text,
    bond                text,
    last_date           text,
    register_links      text[] DEFAULT '{}',
    raw_email_ref       text NOT NULL,
    extraction_method   public.extraction_method_enum DEFAULT 'regex',
    created_at          timestamptz DEFAULT now() NOT NULL,
    updated_at          timestamptz DEFAULT now() NOT NULL,

    -- Prevent duplicate processing of the same email
    CONSTRAINT opportunities_user_email_unique UNIQUE (user_id, raw_email_ref)
);

-- Tracks application status per opportunity.
CREATE TABLE public.applications (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    status          public.application_status_enum DEFAULT 'not_applied' NOT NULL,
    applied_at      timestamptz,
    updated_at      timestamptz DEFAULT now() NOT NULL,

    -- One application record per opportunity per user
    CONSTRAINT applications_user_opportunity_unique UNIQUE (user_id, opportunity_id)
);


-- ========================
-- 3. Indexes
-- ========================

CREATE INDEX idx_email_connections_user_id ON public.email_connections(user_id);
CREATE INDEX idx_llm_keys_user_id ON public.llm_keys(user_id);
CREATE INDEX idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX idx_opportunities_role_type ON public.opportunities(role_type);
CREATE INDEX idx_opportunities_created_at ON public.opportunities(created_at DESC);
CREATE INDEX idx_applications_user_id ON public.applications(user_id);
CREATE INDEX idx_applications_opportunity_id ON public.applications(opportunity_id);
CREATE INDEX idx_applications_status ON public.applications(status);


-- ========================
-- 4. Auto-update updated_at
-- ========================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- ========================
-- 5. Row Level Security
-- ========================

-- Enable RLS on all tables
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ---- email_connections ----

CREATE POLICY "Users can view own email connections"
    ON public.email_connections FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own email connections"
    ON public.email_connections FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own email connections"
    ON public.email_connections FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own email connections"
    ON public.email_connections FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- ---- llm_keys ----

CREATE POLICY "Users can view own LLM keys"
    ON public.llm_keys FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own LLM keys"
    ON public.llm_keys FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own LLM keys"
    ON public.llm_keys FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own LLM keys"
    ON public.llm_keys FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- ---- opportunities ----

CREATE POLICY "Users can view own opportunities"
    ON public.opportunities FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own opportunities"
    ON public.opportunities FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own opportunities"
    ON public.opportunities FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own opportunities"
    ON public.opportunities FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

-- ---- applications ----

CREATE POLICY "Users can view own applications"
    ON public.applications FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own applications"
    ON public.applications FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own applications"
    ON public.applications FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own applications"
    ON public.applications FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);


-- ========================
-- 6. Service role bypass
-- ========================
-- The service_role key already bypasses RLS by default in Supabase.
-- Background jobs use the service_role client scoped to the user's rows
-- by including WHERE user_id = <target_user_id> in every query.
-- No additional policies are needed for service role access.
