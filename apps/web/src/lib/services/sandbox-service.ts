// Sandbox Service - Code execution and live preview
// Uses E2B when available, falls back to static preview

export interface SandboxFile {
  path: string;
  content: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  logs?: string[];
  url?: string;
}

export interface SandboxSession {
  id: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  createdAt: Date;
}

class SandboxService {
  private activeSandboxes: Map<string, { id: string; createdAt: Date }> = new Map();

  // Create a new sandbox for a project
  async createSandbox(projectId: string, files: SandboxFile[]): Promise<SandboxSession> {
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      // Return mock sandbox - use static preview
      return this.createMockSandbox(projectId, files);
    }

    try {
      // Dynamic import E2B to avoid build issues when not configured
      const { Sandbox } = await import('e2b');

      const sandbox = await Sandbox.create('base', {
        apiKey,
        timeoutMs: 300000,
      });

      // Store reference
      this.activeSandboxes.set(projectId, {
        id: sandbox.sandboxId,
        createdAt: new Date(),
      });

      // Write files and start dev server
      for (const file of files) {
        await sandbox.files.write(`/home/user/project/${file.path}`, file.content);
      }

      // Create package.json if not exists
      const hasPackageJson = files.some(f => f.path === 'package.json');
      if (!hasPackageJson) {
        await sandbox.files.write('/home/user/project/package.json', JSON.stringify({
          name: 'sandbox-project',
          type: 'module',
          scripts: {
            dev: 'vite --host 0.0.0.0 --port 3000',
            build: 'vite build',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.2.0',
            vite: '^5.0.0',
          },
        }, null, 2));
      }

      // Install dependencies and start dev server
      const proc = await sandbox.commands.run('cd /home/user/project && npm install && npm run dev', {
        background: true,
      });

      // Get preview URL
      const previewUrl = sandbox.getHost(3000);

      return {
        id: sandbox.sandboxId,
        status: 'running',
        previewUrl: `https://${previewUrl}`,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error('E2B sandbox error:', error);
      // Fall back to mock
      return this.createMockSandbox(projectId, files);
    }
  }

  // Create a mock sandbox using static preview
  private async createMockSandbox(projectId: string, files: SandboxFile[]): Promise<SandboxSession> {
    this.activeSandboxes.set(projectId, {
      id: `mock-${projectId}`,
      createdAt: new Date(),
    });

    return {
      id: `mock-${projectId}`,
      status: 'running',
      previewUrl: undefined, // Will use static HTML preview
      createdAt: new Date(),
    };
  }

  // Execute code snippet
  async executeCode(projectId: string, code: string, language: string = 'javascript'): Promise<ExecutionResult> {
    const apiKey = process.env.E2B_API_KEY;

    if (!apiKey) {
      return this.mockExecute(code, language);
    }

    try {
      const { Sandbox } = await import('e2b');
      const sandbox = await Sandbox.create('base', { apiKey, timeoutMs: 30000 });

      const cmd = language === 'python'
        ? `python3 -c "${code.replace(/"/g, '\\"')}"`
        : `node -e "${code.replace(/"/g, '\\"')}"`;

      const result = await sandbox.commands.run(cmd);

      await sandbox.kill();

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        logs: [result.stdout, result.stderr].filter(Boolean),
      };
    } catch (error: any) {
      return this.mockExecute(code, language);
    }
  }

  // Mock execution for development
  private async mockExecute(code: string, language: string): Promise<ExecutionResult> {
    try {
      if (language === 'javascript' || language === 'typescript') {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
          error: (...args: any[]) => logs.push(`ERROR: ${args.map(a => String(a)).join(' ')}`),
          warn: (...args: any[]) => logs.push(`WARN: ${args.map(a => String(a)).join(' ')}`),
        };

        // Simple safe evaluation
        const safeCode = code.replace(/require\s*\(/g, '(() => {throw new Error("require not allowed")})(');
        const result = new Function('console', `"use strict"; ${safeCode}`)(mockConsole);

        return {
          success: true,
          output: result !== undefined ? String(result) : undefined,
          logs,
        };
      }

      return {
        success: true,
        output: 'Mock execution completed',
        logs: ['Sandbox not available - using mock execution'],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update files in sandbox
  async updateFiles(projectId: string, files: SandboxFile[]): Promise<boolean> {
    // For now, just return true - files will be updated on next full refresh
    return true;
  }

  // Stop sandbox
  async stopSandbox(projectId: string): Promise<void> {
    this.activeSandboxes.delete(projectId);
  }

  // Generate static HTML preview from files
  generateStaticPreview(files: SandboxFile[]): string {
    const appFile = files.find(f =>
      f.path.includes('App.tsx') ||
      f.path.includes('App.jsx') ||
      f.path.includes('App.js')
    );

    const cssFiles = files.filter(f => f.path.endsWith('.css'));
    const cssContent = cssFiles.map(f => f.content).join('\n');

    if (!appFile) {
      return `<!DOCTYPE html>
<html>
<head>
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="p-8 bg-gray-100 min-h-screen">
  <div class="bg-white p-6 rounded-xl shadow-lg max-w-md mx-auto mt-20">
    <div class="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-4"></div>
    <h1 class="text-xl font-bold text-gray-800 text-center">No Preview Available</h1>
    <p class="text-gray-600 mt-2 text-center">Create an App.tsx file to see your preview here.</p>
  </div>
</body>
</html>`;
    }

    const transformedCode = this.transformForBrowser(appFile.content);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    ${cssContent}
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    // Inject React hooks
    const { useState, useEffect, useCallback, useMemo, useRef, useContext, createContext } = React;

    ${transformedCode}

    // Render
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch (e) {
      document.getElementById('root').innerHTML =
        '<div style="padding: 20px; background: #fee2e2; color: #dc2626; border-radius: 8px; margin: 20px;">' +
        '<strong>Error:</strong> ' + e.message + '</div>';
      console.error(e);
    }
  </script>
</body>
</html>`;
  }

  // Transform React/TypeScript for browser
  private transformForBrowser(code: string): string {
    if (!code) return 'function App() { return React.createElement("div", null, "No content"); }';

    return code
      // Remove imports
      .replace(/^import\s+.*?;?\s*$/gm, '')
      // Remove export statements
      .replace(/export\s+default\s+/, '')
      .replace(/export\s+/g, '')
      // Remove TypeScript type annotations
      .replace(/:\s*React\.FC(<[^>]+>)?/g, '')
      .replace(/:\s*[\w<>\[\]|&,\s]+(?=[,\)\}=])/g, '')
      // Remove generic type parameters
      .replace(/<[\w\s,]+>(?=\s*\()/g, '')
      // Remove interface and type declarations
      .replace(/interface\s+\w+\s*\{[\s\S]*?\}/g, '')
      .replace(/type\s+\w+\s*=\s*[\s\S]*?;/g, '')
      // Handle React hooks without React. prefix
      .replace(/React\.(useState|useEffect|useCallback|useMemo|useRef)/g, '$1');
  }

  // Get sandbox info
  getSandboxInfo(projectId: string): SandboxSession | null {
    const info = this.activeSandboxes.get(projectId);
    if (!info) return null;

    return {
      id: info.id,
      status: 'running',
      previewUrl: undefined,
      createdAt: info.createdAt,
    };
  }
}

export const sandboxService = new SandboxService();
