// Database Types

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  framework: 'react' | 'nextjs' | 'vue';
  supabase_project_id: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  deployed_url: string | null;
  custom_domain: string | null;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  language: string | null;
  is_directory: boolean;
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  project_id: string;
  version_number: number;
  name: string | null;
  description: string | null;
  snapshot: Record<string, any>;
  created_by: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  files_changed: string[] | null;
  tokens_used: number | null;
  created_at: string;
}

export interface Deployment {
  id: string;
  project_id: string;
  version_id: string | null;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Usage {
  id: string;
  workspace_id: string;
  type: 'ai_tokens' | 'hosting_bandwidth' | 'storage' | 'compute';
  amount: number;
  project_id: string | null;
  created_at: string;
}

// Extended types with relations

export interface ProjectWithRelations extends Project {
  workspace?: Workspace;
  files?: File[];
  conversations?: ConversationWithMessages[];
}

export interface ConversationWithMessages extends Conversation {
  messages?: Message[];
}

export interface WorkspaceMemberWithWorkspace extends WorkspaceMember {
  workspace?: Workspace;
}
