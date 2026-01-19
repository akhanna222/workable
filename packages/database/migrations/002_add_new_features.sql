-- =============================================
-- MIGRATION: Add new features for Lovable parity
-- =============================================

-- =============================================
-- FILE VERSION HISTORY
-- =============================================

CREATE TABLE IF NOT EXISTS public.file_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    version_number INTEGER,
    message TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-increment version number
CREATE OR REPLACE FUNCTION public.set_file_version_number()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
    FROM public.file_versions
    WHERE file_id = NEW.file_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_version_number
    BEFORE INSERT ON public.file_versions
    FOR EACH ROW EXECUTE FUNCTION public.set_file_version_number();

-- =============================================
-- PROJECT SNAPSHOTS (Full project backups)
-- =============================================

CREATE TABLE IF NOT EXISTS public.project_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    files JSONB NOT NULL,  -- Array of {path, content, language}
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SUBSCRIPTIONS & BILLING
-- =============================================

-- Add stripe customer ID to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    plan_id TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')) DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Request tracking for usage limits
CREATE TABLE IF NOT EXISTS public.ai_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    tokens_used INTEGER DEFAULT 0,
    model TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GITHUB INTEGRATION
-- =============================================

-- Add github info to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS github_username TEXT,
ADD COLUMN IF NOT EXISTS github_access_token TEXT;

-- Track GitHub exports
CREATE TABLE IF NOT EXISTS public.github_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    repo_name TEXT NOT NULL,
    repo_url TEXT,
    last_exported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEPLOYMENT TRACKING UPDATES
-- =============================================

-- Add provider and more fields to deployments
ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('vercel', 'netlify', 'custom')) DEFAULT 'vercel',
ADD COLUMN IF NOT EXISTS provider_deployment_id TEXT,
ADD COLUMN IF NOT EXISTS build_logs TEXT;

-- =============================================
-- COLLABORATION
-- =============================================

-- Project collaborator invites
CREATE TABLE IF NOT EXISTS public.project_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('editor', 'viewer')) DEFAULT 'editor',
    token TEXT UNIQUE NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USER SETTINGS & PREFERENCES
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,

    -- API Keys (should be encrypted in production via pgcrypto)
    anthropic_api_key TEXT,
    openai_api_key TEXT,
    vercel_token TEXT,
    netlify_token TEXT,
    github_token TEXT,

    -- Flags for checking if keys exist (avoid exposing actual keys)
    has_anthropic_key BOOLEAN DEFAULT FALSE,
    has_openai_key BOOLEAN DEFAULT FALSE,
    has_vercel_token BOOLEAN DEFAULT FALSE,
    has_netlify_token BOOLEAN DEFAULT FALSE,
    has_github_token BOOLEAN DEFAULT FALSE,

    -- User preferences (stored as JSONB for flexibility)
    settings JSONB DEFAULT '{
        "default_framework": "react",
        "default_styling": "tailwind",
        "default_language": "typescript",
        "editor_theme": "vs-dark",
        "editor_font_size": 14,
        "editor_tab_size": 2,
        "editor_word_wrap": true,
        "email_notifications": true,
        "deploy_notifications": true,
        "collaboration_notifications": true,
        "profile_public": false,
        "show_activity": true
    }'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- =============================================

ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- File versions - same as files
CREATE POLICY "Project editors can manage file versions" ON public.file_versions
    FOR ALL USING (
        file_id IN (
            SELECT f.id FROM public.files f
            JOIN public.projects p ON f.project_id = p.id
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

-- Project snapshots
CREATE POLICY "Project editors can manage snapshots" ON public.project_snapshots
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Subscriptions - users can view their own
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- AI requests - users can view/insert their own
CREATE POLICY "Users can view own ai requests" ON public.ai_requests
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own ai requests" ON public.ai_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- GitHub exports - project editors
CREATE POLICY "Project editors can manage github exports" ON public.github_exports
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Project invites - project admins
CREATE POLICY "Project admins can manage invites" ON public.project_invites
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
    );

-- User settings - users can manage their own
CREATE POLICY "Users can manage own settings" ON public.user_settings
    FOR ALL USING (user_id = auth.uid());

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_file_versions_file ON public.file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_created ON public.file_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_project ON public.project_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON public.ai_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON public.ai_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_github_exports_project ON public.github_exports(project_id);

-- =============================================
-- TRIGGER FOR SUBSCRIPTION UPDATES
-- =============================================

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
