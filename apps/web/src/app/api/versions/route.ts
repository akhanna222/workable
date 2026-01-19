// Version History API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get versions for a file or project snapshots
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  const projectId = request.nextUrl.searchParams.get('projectId');
  const type = request.nextUrl.searchParams.get('type') || 'file'; // 'file' or 'snapshot'

  try {
    const supabase = await createClient();

    if (type === 'snapshot' && projectId) {
      // Get project snapshots
      const { data, error } = await supabase
        .from('project_snapshots')
        .select('id, name, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ snapshots: data });
    }

    if (fileId) {
      // Get file versions
      const { data, error } = await supabase
        .from('file_versions')
        .select('id, version_number, created_at, created_by, message')
        .eq('file_id', fileId)
        .order('version_number', { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json({ versions: data });
    }

    return NextResponse.json({ error: 'Missing fileId or projectId' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a snapshot or restore a version
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, projectId, fileId, versionId, snapshotId, name } = body;

    if (action === 'create_snapshot') {
      // Create project snapshot
      const { data: files } = await supabase
        .from('files')
        .select('path, content, language')
        .eq('project_id', projectId);

      const { data, error } = await supabase
        .from('project_snapshots')
        .insert({
          project_id: projectId,
          name: name || `Snapshot ${new Date().toLocaleString()}`,
          files: files || [],
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ snapshot: data });
    }

    if (action === 'restore_snapshot') {
      // Restore project from snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('project_snapshots')
        .select('files')
        .eq('id', snapshotId)
        .single();

      if (snapshotError) throw snapshotError;

      // Delete current files
      await supabase.from('files').delete().eq('project_id', projectId);

      // Restore files
      const files = snapshot.files as { path: string; content: string; language: string }[];
      for (const file of files) {
        await supabase.from('files').insert({
          project_id: projectId,
          path: file.path,
          content: file.content,
          language: file.language,
          created_by: user.id,
        });
      }

      return NextResponse.json({ success: true, filesRestored: files.length });
    }

    if (action === 'restore_file_version') {
      // Restore file to specific version
      const { data: version, error: versionError } = await supabase
        .from('file_versions')
        .select('content')
        .eq('id', versionId)
        .single();

      if (versionError) throw versionError;

      const { error: updateError } = await supabase
        .from('files')
        .update({
          content: version.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId);

      if (updateError) throw updateError;

      // Create new version marking the restore
      await supabase.from('file_versions').insert({
        file_id: fileId,
        content: version.content,
        message: 'Restored from previous version',
        created_by: user.id,
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'get_version_content') {
      // Get specific version content
      const { data, error } = await supabase
        .from('file_versions')
        .select('content')
        .eq('id', versionId)
        .single();

      if (error) throw error;
      return NextResponse.json({ content: data.content });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
