// Multi-Agent Architecture Types

export type AgentRole =
  | 'orchestrator'
  | 'ui'
  | 'backend'
  | 'database'
  | 'devops'
  | 'reviewer';

export interface AgentTask {
  id: string;
  type: 'create' | 'modify' | 'review' | 'fix';
  description: string;
  assignedTo: AgentRole;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[]; // Task IDs this depends on
  result?: TaskResult;
  createdAt: Date;
  completedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  files?: GeneratedFile[];
  message?: string;
  error?: string;
  suggestions?: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  action: 'create' | 'modify' | 'delete';
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentRole?: AgentRole;
  timestamp: Date;
}

export interface AgentContext {
  projectId: string;
  conversationId: string;
  existingFiles: GeneratedFile[];
  projectDescription?: string;
  techStack: TechStack;
  tasks: AgentTask[];
  messages: AgentMessage[];
}

export interface TechStack {
  frontend: 'react' | 'nextjs' | 'vue';
  styling: 'tailwind' | 'css' | 'styled-components';
  backend: 'nextjs-api' | 'express' | 'supabase-functions';
  database: 'supabase' | 'prisma' | 'none';
  auth: 'supabase-auth' | 'nextauth' | 'none';
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  filePatterns: string[]; // What files this agent can create/modify
}

export interface OrchestratorPlan {
  summary: string;
  tasks: {
    order: number;
    agent: AgentRole;
    description: string;
    files: string[];
    dependencies?: number[]; // Order numbers of tasks this depends on
  }[];
  estimatedFiles: number;
}

export interface AgentResponse {
  agentRole: AgentRole;
  thinking?: string;
  plan?: OrchestratorPlan;
  files?: GeneratedFile[];
  message: string;
  nextAgent?: AgentRole;
  completed: boolean;
}

// Event types for real-time updates
export type AgentEventType =
  | 'agent_started'
  | 'agent_thinking'
  | 'agent_writing'
  | 'agent_completed'
  | 'file_created'
  | 'file_modified'
  | 'task_started'
  | 'task_completed'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  agentRole?: AgentRole;
  taskId?: string;
  message: string;
  data?: any;
  timestamp: Date;
}
