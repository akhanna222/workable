import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Clock, Globe, Lock, FolderKanban } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user!.id);

  const workspaceIds = memberships?.map((m) => m.workspace_id) || [];

  // Get projects in user's workspaces
  const { data: projects } = await supabase
    .from('projects')
    .select(
      `
      *,
      workspace:workspaces(name)
    `
    )
    .in('workspace_id', workspaceIds)
    .order('updated_at', { ascending: false });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 mt-1">Manage your AI-generated applications</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {projects?.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group block p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
    >
      {/* Preview Thumbnail */}
      <div className="aspect-video bg-gray-800 rounded-lg mb-4 overflow-hidden flex items-center justify-center">
        {project.deployed_url ? (
          <iframe
            src={project.deployed_url}
            className="w-full h-full pointer-events-none scale-50 origin-top-left"
            style={{ width: '200%', height: '200%' }}
            sandbox=""
            title={`${project.name} preview`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
            <FolderKanban className="w-8 h-8 mb-2" />
            <span className="text-sm">No preview</span>
          </div>
        )}
      </div>

      {/* Project Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
            {project.name}
          </h3>
          <span title={project.is_public ? 'Public' : 'Private'}>
            {project.is_public ? (
              <Globe className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
            ) : (
              <Lock className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
            )}
          </span>
        </div>

        {project.description && (
          <p className="text-sm text-gray-400 line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Updated {formatDistanceToNow(new Date(project.updated_at))}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
        <FolderKanban className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
      <p className="text-gray-400 mb-4">Create your first AI-powered application</p>
      <Link
        href="/dashboard/projects/new"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Project
      </Link>
    </div>
  );
}
