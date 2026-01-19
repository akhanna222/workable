-- =============================================
-- LOVABLE CLONE DATABASE SCHEMA
-- =============================================

-- =============================================
-- USERS & WORKSPACES
-- =============================================

-- Extend Supabase auth.users with profile data
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces (teams/organizations)
CREATE TABLE public.workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members
CREATE TABLE public.workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')) DEFAULT 'editor',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- =============================================
-- PROJECTS
-- =============================================

CREATE TABLE public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,

    -- Project settings
    framework TEXT DEFAULT 'react' CHECK (framework IN ('react', 'nextjs', 'vue')),

    -- Supabase connection for generated app
    supabase_project_id TEXT,
    supabase_url TEXT,
    supabase_anon_key TEXT,

    -- Deployment info
    deployed_url TEXT,
    custom_domain TEXT,
    last_deployed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(workspace_id, slug)
);

-- =============================================
-- FILES & CODE
-- =============================================

CREATE TABLE public.files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    path TEXT NOT NULL,                    -- e.g., "src/components/Button.tsx"
    content TEXT,                          -- File content
    language TEXT,                         -- e.g., "typescript", "css"
    is_directory BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, path)
);

-- =============================================
-- VERSIONS (Git-like history)
-- =============================================

CREATE TABLE public.versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    name TEXT,                             -- Optional label
    description TEXT,                      -- What changed
    snapshot JSONB NOT NULL,               -- Full file tree snapshot

    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, version_number)
);

-- =============================================
-- CHAT & MESSAGES
-- =============================================

CREATE TABLE public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,

    -- Track what files were created/modified
    files_changed JSONB,                   -- Array of file paths

    -- Token usage for billing
    tokens_used INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEPLOYMENTS
-- =============================================

CREATE TABLE public.deployments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    version_id UUID REFERENCES public.versions(id),

    status TEXT CHECK (status IN ('pending', 'building', 'deployed', 'failed')) DEFAULT 'pending',
    url TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =============================================
-- USAGE & BILLING
-- =============================================

CREATE TABLE public.usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,

    -- Usage type
    type TEXT CHECK (type IN ('ai_tokens', 'hosting_bandwidth', 'storage', 'compute')) NOT NULL,
    amount INTEGER NOT NULL,

    -- Reference to what caused the usage
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Workspaces: Members can view, owners can modify
CREATE POLICY "Workspace members can view" ON public.workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can create workspaces" ON public.workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update workspace" ON public.workspaces
    FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete workspace" ON public.workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- Workspace members
CREATE POLICY "Members can view workspace members" ON public.workspace_members
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    );
CREATE POLICY "Owners can manage workspace members" ON public.workspace_members
    FOR ALL USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    );

-- Projects: Workspace members can access
CREATE POLICY "Workspace members can view projects" ON public.projects
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
        OR is_public = TRUE
    );
CREATE POLICY "Workspace editors can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
        )
    );
CREATE POLICY "Workspace editors can update projects" ON public.projects
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
        )
    );
CREATE POLICY "Workspace editors can delete projects" ON public.projects
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Files: Same as projects
CREATE POLICY "Project members can view files" ON public.files
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );
CREATE POLICY "Project editors can manage files" ON public.files
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Versions
CREATE POLICY "Project members can view versions" ON public.versions
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );
CREATE POLICY "Project editors can create versions" ON public.versions
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Conversations
CREATE POLICY "Project members can view conversations" ON public.conversations
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );
CREATE POLICY "Project editors can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Messages
CREATE POLICY "Conversation members can view messages" ON public.messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT c.id FROM public.conversations c
            JOIN public.projects p ON c.project_id = p.id
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );
CREATE POLICY "Project editors can create messages" ON public.messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT c.id FROM public.conversations c
            JOIN public.projects p ON c.project_id = p.id
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Deployments
CREATE POLICY "Project members can view deployments" ON public.deployments
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );
CREATE POLICY "Project editors can create deployments" ON public.deployments
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM public.projects p
            JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin', 'editor')
        )
    );

-- Usage
CREATE POLICY "Workspace members can view usage" ON public.usage
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    );
CREATE POLICY "System can insert usage" ON public.usage
    FOR INSERT WITH CHECK (true);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Create default workspace for new user
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
        NEW.id::TEXT,
        NEW.id
    )
    RETURNING id INTO new_workspace_id;

    -- Add user as owner of their workspace
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX idx_projects_slug ON public.projects(workspace_id, slug);
CREATE INDEX idx_files_project ON public.files(project_id);
CREATE INDEX idx_files_path ON public.files(project_id, path);
CREATE INDEX idx_versions_project ON public.versions(project_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_conversations_project ON public.conversations(project_id);
CREATE INDEX idx_deployments_project ON public.deployments(project_id);
CREATE INDEX idx_usage_workspace ON public.usage(workspace_id);
CREATE INDEX idx_usage_created ON public.usage(created_at);
