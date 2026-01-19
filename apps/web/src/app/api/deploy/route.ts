// Deployment API - Deploy to Vercel/Netlify
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, provider, token } = await request.json();

    if (!projectId || !provider) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get project files
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('path, content, language')
      .eq('project_id', projectId);

    if (filesError) throw filesError;

    // Get project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name, slug')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    if (provider === 'vercel') {
      return await deployToVercel(files, project, token);
    } else if (provider === 'netlify') {
      return await deployToNetlify(files, project, token);
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Deploy error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function deployToVercel(
  files: { path: string; content: string }[],
  project: { name: string; slug: string },
  token: string
) {
  // Create a Vite project structure
  const vercelFiles = [
    ...files.map(f => ({
      file: f.path,
      data: f.content,
    })),
    // Add essential files if missing
    {
      file: 'package.json',
      data: JSON.stringify({
        name: project.slug,
        private: true,
        version: '0.0.0',
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
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.2.0',
          typescript: '^5.2.0',
          vite: '^5.0.0',
        },
      }, null, 2),
    },
    {
      file: 'vite.config.ts',
      data: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    },
    {
      file: 'index.html',
      data: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    {
      file: 'src/main.tsx',
      data: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
    },
  ];

  // Remove duplicates, preferring user files
  const fileMap = new Map();
  vercelFiles.forEach(f => {
    if (!fileMap.has(f.file)) {
      fileMap.set(f.file, f);
    }
  });

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: project.slug,
      files: Array.from(fileMap.values()),
      projectSettings: {
        framework: 'vite',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json(
      { error: error.error?.message || 'Vercel deployment failed' },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    id: data.id,
    url: `https://${data.url}`,
    status: data.readyState === 'READY' ? 'ready' : 'building',
    provider: 'vercel',
  });
}

async function deployToNetlify(
  files: { path: string; content: string }[],
  project: { name: string; slug: string },
  token: string
) {
  // For Netlify, we'd create a zip and upload
  // This is a simplified version

  // Create site if needed
  const createSiteRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: project.slug,
    }),
  });

  if (!createSiteRes.ok && createSiteRes.status !== 422) {
    const error = await createSiteRes.json();
    return NextResponse.json(
      { error: error.message || 'Netlify deployment failed' },
      { status: createSiteRes.status }
    );
  }

  const site = await createSiteRes.json();

  // Deploy files (simplified - in production would use proper deploy API)
  return NextResponse.json({
    id: site.id,
    url: site.ssl_url || site.url,
    status: 'building',
    provider: 'netlify',
  });
}

// GET - Check deployment status
export async function GET(request: NextRequest) {
  const deploymentId = request.nextUrl.searchParams.get('id');
  const provider = request.nextUrl.searchParams.get('provider');
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!deploymentId || !provider || !token) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  try {
    if (provider === 'vercel') {
      const response = await fetch(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get deployment status');
      }

      const data = await response.json();
      return NextResponse.json({
        id: data.id,
        url: `https://${data.url}`,
        status: mapVercelStatus(data.readyState),
        errorMessage: data.errorMessage,
      });
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function mapVercelStatus(state: string): string {
  switch (state) {
    case 'READY': return 'ready';
    case 'ERROR': return 'error';
    case 'QUEUED': return 'queued';
    default: return 'building';
  }
}
