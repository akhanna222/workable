import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, FolderKanban, ArrowRight, Sparkles } from 'lucide-react';

export default async function DashboardPage() {
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

  // Get recent projects
  const { data: recentProjects } = await supabase
    .from('projects')
    .select('*')
    .in('workspace_id', workspaceIds)
    .order('updated_at', { ascending: false })
    .limit(5);

  // Get project count
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your projects
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard/projects/new"
          className="group p-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-white/80 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Create with AI</span>
              </div>
              <h3 className="text-xl font-bold text-white">New Project</h3>
              <p className="text-white/70 text-sm mt-1">
                Describe what you want to build
              </p>
            </div>
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Plus className="w-5 h-5 text-white" />
            </div>
          </div>
        </Link>

        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Projects</p>
              <p className="text-3xl font-bold text-white mt-1">{projectCount || 0}</p>
            </div>
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">AI Credits</p>
              <p className="text-3xl font-bold text-white mt-1">Unlimited</p>
            </div>
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentProjects && recentProjects.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{project.name}</h3>
                    <p className="text-sm text-gray-500">
                      {project.description || 'No description'}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(project.updated_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
              <FolderKanban className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first AI-powered application
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
