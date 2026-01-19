import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ProjectEditor } from '@/components/editor/project-editor';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch project with workspace info
  const { data: project, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      workspace:workspaces(*),
      files(*),
      conversations(
        *,
        messages(*)
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Verify user has access
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership && !project.is_public) {
    notFound();
  }

  // Sort messages by created_at
  const conversation = project.conversations?.[0];
  const messages = conversation?.messages?.sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ) || [];

  return (
    <ProjectEditor
      project={project}
      files={project.files || []}
      conversation={conversation}
      messages={messages}
      userRole={membership?.role || 'viewer'}
    />
  );
}
