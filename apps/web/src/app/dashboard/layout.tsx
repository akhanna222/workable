import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch user's workspaces
  const { data: workspaces } = await supabase
    .from('workspace_members')
    .select(
      `
      workspace:workspaces(id, name, slug)
    `
    )
    .eq('user_id', user.id);

  const userWorkspaces: Workspace[] = (workspaces || [])
    .flatMap((w: { workspace: Workspace[] | Workspace | null }) => {
      if (Array.isArray(w.workspace)) return w.workspace;
      if (w.workspace) return [w.workspace];
      return [];
    });

  return (
    <div className="h-screen flex bg-gray-950">
      <Sidebar user={profile} workspaces={userWorkspaces} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={profile} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
