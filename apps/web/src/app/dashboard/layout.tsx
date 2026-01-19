import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

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
      workspace:workspaces(*)
    `
    )
    .eq('user_id', user.id);

  const userWorkspaces = workspaces?.map((w) => w.workspace).filter(Boolean) || [];

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
