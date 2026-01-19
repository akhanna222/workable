// GitHub Export API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, repoName, isPrivate, githubToken, commitMessage } = await request.json();

    if (!projectId || !repoName || !githubToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get project files
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('path, content')
      .eq('project_id', projectId);

    if (filesError) throw filesError;

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single();

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    };

    // Check if repo exists
    const checkRepoRes = await fetch(`https://api.github.com/user/repos`, {
      headers,
    });

    const existingRepos = await checkRepoRes.json();
    let repo = existingRepos.find((r: any) => r.name === repoName);

    // Create repo if doesn't exist
    if (!repo) {
      const createRepoRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: project?.description || `Created with BuilderAI`,
          private: isPrivate ?? false,
          auto_init: true,
        }),
      });

      if (!createRepoRes.ok) {
        const error = await createRepoRes.json();
        return NextResponse.json(
          { error: error.message || 'Failed to create repository' },
          { status: createRepoRes.status }
        );
      }

      repo = await createRepoRes.json();

      // Wait for repo initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Upload each file
    const uploadResults = [];
    for (const file of files || []) {
      // Check if file exists
      const fileCheckRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
        { headers }
      );

      let sha: string | undefined;
      if (fileCheckRes.ok) {
        const existingFile = await fileCheckRes.json();
        sha = existingFile.sha;
      }

      // Upload/update file
      const uploadRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: commitMessage || `Update ${file.path} from BuilderAI`,
            content: Buffer.from(file.content || '').toString('base64'),
            sha,
          }),
        }
      );

      if (uploadRes.ok) {
        uploadResults.push({ path: file.path, success: true });
      } else {
        const error = await uploadRes.json();
        uploadResults.push({ path: file.path, success: false, error: error.message });
      }
    }

    // Add essential files
    const essentialFiles = [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: repoName,
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.0.0',
            vite: '^5.0.0',
            tailwindcss: '^3.4.0',
          },
        }, null, 2),
      },
      {
        path: 'README.md',
        content: `# ${project?.name || repoName}\n\n${project?.description || ''}\n\nGenerated with [BuilderAI](https://builderai.app)\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``,
      },
    ];

    for (const file of essentialFiles) {
      const fileCheckRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
        { headers }
      );

      let sha: string | undefined;
      if (fileCheckRes.ok) {
        const existingFile = await fileCheckRes.json();
        sha = existingFile.sha;
      }

      await fetch(
        `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Add ${file.path}`,
            content: Buffer.from(file.content).toString('base64'),
            sha,
          }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      repoUrl: repo.html_url,
      repoName: repo.full_name,
      filesUploaded: uploadResults.filter(r => r.success).length,
      totalFiles: uploadResults.length,
    });
  } catch (error: any) {
    console.error('GitHub export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
