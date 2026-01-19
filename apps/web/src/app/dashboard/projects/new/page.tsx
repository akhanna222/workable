'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn, slugify } from '@/lib/utils';

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with an empty canvas',
    icon: '📝',
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Marketing page with hero, features, and CTA',
    icon: '🚀',
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin dashboard with charts and tables',
    icon: '📊',
  },
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Full SaaS app with auth, billing, and dashboard',
    icon: '💼',
  },
];

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get user and default workspace
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        throw new Error('No workspace found');
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          workspace_id: membership.workspace_id,
          name,
          slug: slugify(name),
          description,
          framework: 'react',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create initial conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({ project_id: project.id })
        .select()
        .single();

      if (convError) throw convError;

      // If user provided a prompt, save it as first message
      if (prompt.trim()) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          role: 'user',
          content: prompt,
        });
      }

      // Redirect to project editor
      router.push(`/project/${project.id}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Create new project</h1>
      <p className="text-gray-400 mb-8">
        Start with a template or describe what you want to build
      </p>

      {error && (
        <div className="p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="My Awesome App"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="A brief description of your project"
          />
        </div>

        {/* Templates */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start from template
          </label>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={cn(
                  'p-4 text-left rounded-lg border transition-colors',
                  template === t.id
                    ? 'bg-blue-600/10 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                )}
              >
                <div className="text-2xl mb-2">{t.icon}</div>
                <div className="font-medium text-white">{t.name}</div>
                <div className="text-sm text-gray-400">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Initial Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Sparkles className="w-4 h-4 inline mr-1 text-blue-400" />
            Describe what you want to build{' '}
            <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Build a task management app with projects, tasks, due dates, and team collaboration features..."
          />
          <p className="mt-1 text-xs text-gray-500">
            The more details you provide, the better the AI can understand your vision
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
