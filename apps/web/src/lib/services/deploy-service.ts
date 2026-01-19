// Deployment Service - Deploy to Vercel, Netlify
import { ProjectFile } from './file-service';

export interface DeploymentConfig {
  provider: 'vercel' | 'netlify';
  projectName: string;
  framework?: 'react' | 'nextjs' | 'vite';
  buildCommand?: string;
  outputDirectory?: string;
}

export interface Deployment {
  id: string;
  url: string;
  status: 'queued' | 'building' | 'ready' | 'error';
  createdAt: string;
  provider: string;
  errorMessage?: string;
}

class DeployService {
  // Deploy to Vercel
  async deployToVercel(
    files: ProjectFile[],
    config: DeploymentConfig,
    vercelToken: string
  ): Promise<Deployment> {
    // Convert files to Vercel deployment format
    const vercelFiles = files.map(file => ({
      file: file.path,
      data: file.content,
    }));

    // Create deployment
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.projectName,
        files: vercelFiles,
        projectSettings: {
          framework: config.framework || 'vite',
          buildCommand: config.buildCommand || 'npm run build',
          outputDirectory: config.outputDirectory || 'dist',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Deployment failed');
    }

    const data = await response.json();
    return {
      id: data.id,
      url: `https://${data.url}`,
      status: data.readyState === 'READY' ? 'ready' : 'building',
      createdAt: data.createdAt,
      provider: 'vercel',
    };
  }

  // Check deployment status
  async getDeploymentStatus(deploymentId: string, vercelToken: string): Promise<Deployment> {
    const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get deployment status');
    }

    const data = await response.json();
    return {
      id: data.id,
      url: `https://${data.url}`,
      status: this.mapVercelStatus(data.readyState),
      createdAt: data.createdAt,
      provider: 'vercel',
      errorMessage: data.errorMessage,
    };
  }

  private mapVercelStatus(state: string): Deployment['status'] {
    switch (state) {
      case 'READY': return 'ready';
      case 'ERROR': return 'error';
      case 'QUEUED': return 'queued';
      default: return 'building';
    }
  }

  // Deploy to Netlify
  async deployToNetlify(
    files: ProjectFile[],
    config: DeploymentConfig,
    netlifyToken: string
  ): Promise<Deployment> {
    // Create a zip file of the project
    const zipContent = await this.createZipFromFiles(files);

    // Create new site deploy
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/zip',
      },
      body: zipContent,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Deployment failed');
    }

    const data = await response.json();
    return {
      id: data.id,
      url: data.ssl_url || data.url,
      status: data.state === 'ready' ? 'ready' : 'building',
      createdAt: data.created_at,
      provider: 'netlify',
    };
  }

  // Create a zip file from project files (simplified - would need JSZip in real impl)
  private async createZipFromFiles(files: ProjectFile[]): Promise<Blob> {
    // In production, use JSZip library
    // This is a placeholder that creates a basic structure
    const content = files.map(f => `${f.path}:\n${f.content}`).join('\n---\n');
    return new Blob([content], { type: 'application/zip' });
  }

  // Generate static site for preview/download
  generateStaticSite(files: ProjectFile[]): string {
    const appFile = files.find(f =>
      f.path.includes('App.tsx') ||
      f.path.includes('App.jsx') ||
      f.path.includes('App.js')
    );

    const cssFile = files.find(f =>
      f.path.includes('.css')
    );

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${cssFile?.content || ''}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${this.transformForBrowser(appFile?.content || '')}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;

    return htmlTemplate;
  }

  private transformForBrowser(code: string): string {
    if (!code) return 'function App() { return <div>No App</div>; }';

    return code
      .replace(/^import\s+.*?;?\s*$/gm, '')
      .replace(/export\s+default\s+/, '')
      .replace(/:\s*React\.FC(<[^>]+>)?/g, '')
      .replace(/:\s*\w+(\[\])?\s*(?=[,\)\}=])/g, '')
      .replace(/<\w+>/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
  }
}

export const deployService = new DeployService();
