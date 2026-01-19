// File Persistence API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch project files
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('path');

    if (error) throw error;

    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create or update files
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, files } = await request.json();

    if (!projectId || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const savedFiles = [];

    for (const file of files) {
      // Check if file exists
      const { data: existing } = await supabase
        .from('files')
        .select('id')
        .eq('project_id', projectId)
        .eq('path', file.path)
        .single();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('files')
          .update({
            content: file.content,
            language: file.language || detectLanguage(file.path),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        savedFiles.push(data);

        // Create version
        await supabase.from('file_versions').insert({
          file_id: existing.id,
          content: file.content,
          created_by: user.id,
        });
      } else {
        // Create
        const { data, error } = await supabase
          .from('files')
          .insert({
            project_id: projectId,
            path: file.path,
            content: file.content,
            language: file.language || detectLanguage(file.path),
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        savedFiles.push(data);
      }
    }

    return NextResponse.json({ files: savedFiles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, path } = await request.json();

    const { error } = await supabase
      .from('files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    py: 'python',
    sql: 'sql',
  };
  return languageMap[ext || ''] || 'plaintext';
}
