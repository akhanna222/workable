// Sandbox API - Code execution and live preview
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sandboxService } from '@/lib/services/sandbox-service';

// POST - Create or update sandbox
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, projectId, files, code, language } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Verify user has access to project
    const { data: project } = await supabase
      .from('projects')
      .select('id, workspace_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    switch (action) {
      case 'create': {
        // Get project files if not provided
        let projectFiles = files;
        if (!projectFiles) {
          const { data: dbFiles } = await supabase
            .from('files')
            .select('path, content')
            .eq('project_id', projectId);
          projectFiles = dbFiles || [];
        }

        const session = await sandboxService.createSandbox(projectId, projectFiles);
        return NextResponse.json(session);
      }

      case 'execute': {
        if (!code) {
          return NextResponse.json({ error: 'Code required' }, { status: 400 });
        }
        const result = await sandboxService.executeCode(projectId, code, language);
        return NextResponse.json(result);
      }

      case 'update': {
        if (!files) {
          return NextResponse.json({ error: 'Files required' }, { status: 400 });
        }
        const success = await sandboxService.updateFiles(projectId, files);
        return NextResponse.json({ success });
      }

      case 'stop': {
        await sandboxService.stopSandbox(projectId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Sandbox error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Get sandbox status or preview
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const type = request.nextUrl.searchParams.get('type') || 'status';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (type === 'preview') {
      // Get project files and generate static preview
      const { data: files } = await supabase
        .from('files')
        .select('path, content')
        .eq('project_id', projectId);

      const html = sandboxService.generateStaticPreview(files || []);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Return sandbox status
    const info = sandboxService.getSandboxInfo(projectId);
    return NextResponse.json(info || { status: 'not_running' });
  } catch (error: any) {
    console.error('Sandbox GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
