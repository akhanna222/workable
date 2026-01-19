'use client';

import { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  Loader2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface File {
  path: string;
  content: string | null;
}

interface PreviewPanelProps {
  projectId: string;
  files: File[];
}

type DeviceSize = 'mobile' | 'tablet' | 'desktop';

const DEVICE_SIZES: Record<DeviceSize, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobile' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '100%', label: 'Desktop' },
};

export function PreviewPanel({ projectId, files }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceSize>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate preview HTML from files
  const previewHtml = generatePreviewHtml(files);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewHtml;
    }
  };

  const handleOpenExternal = () => {
    // Open preview in new tab using blob URL
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-1">
          {/* Device Toggles */}
          <button
            onClick={() => setDevice('mobile')}
            className={cn(
              'p-1.5 rounded transition-colors',
              device === 'mobile'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Mobile"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={cn(
              'p-1.5 rounded transition-colors',
              device === 'tablet'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Tablet"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('desktop')}
            className={cn(
              'p-1.5 rounded transition-colors',
              device === 'desktop'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            )}
            title="Desktop"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-2 text-xs">
            {files.length > 0 ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-400">Preview</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-gray-500">No files</span>
              </>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Open in new tab"
            disabled={files.length === 0}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-gray-900 overflow-auto flex items-start justify-center p-4">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-gray-600" />
            </div>
            <span className="text-gray-400 font-medium">No preview available</span>
            <span className="text-gray-500 text-sm max-w-xs">
              Start a conversation with the AI to generate your application
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300',
              device !== 'desktop' && 'border border-gray-700'
            )}
            style={{
              width: DEVICE_SIZES[device].width,
              height: device === 'desktop' ? '100%' : '667px',
              maxWidth: '100%',
            }}
          >
            <iframe
              ref={iframeRef}
              key={refreshKey}
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function generatePreviewHtml(files: File[]): string {
  // Find key files
  const appFile = files.find(
    (f) =>
      f.path === 'src/App.tsx' ||
      f.path === 'src/App.jsx' ||
      f.path === 'App.tsx' ||
      f.path === 'App.jsx'
  );
  const cssFile = files.find(
    (f) =>
      f.path === 'src/index.css' ||
      f.path === 'index.css' ||
      f.path === 'src/styles.css' ||
      f.path === 'styles.css'
  );
  const htmlFile = files.find(
    (f) => f.path === 'index.html' || f.path === 'public/index.html'
  );

  // Basic HTML template with Tailwind CDN
  const css = cssFile?.content || '';
  const appCode = appFile?.content || '';

  // Convert JSX/TSX to something renderable (simplified)
  // In a real implementation, you'd use a proper transpiler
  const componentCode = transformReactCode(appCode);

  return `
<!DOCTYPE html>
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
    ${css}
    body { margin: 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${componentCode}

    // Render the App
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch (e) {
      document.getElementById('root').innerHTML = '<div style="padding: 20px; color: red;">' + e.message + '</div>';
    }
  </script>
</body>
</html>
  `;
}

function transformReactCode(code: string): string {
  if (!code) return 'function App() { return React.createElement("div", null, "No App component found"); }';

  // Remove TypeScript types (simplified)
  let transformed = code
    // Remove import statements (we use global React)
    .replace(/^import\s+.*?;?\s*$/gm, '')
    // Remove export default
    .replace(/export\s+default\s+/, '')
    // Remove TypeScript type annotations
    .replace(/:\s*\w+(\[\])?\s*(?=[,\)\}=])/g, '')
    .replace(/<\w+>/g, '')
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
    // Remove React.FC type
    .replace(/:\s*React\.FC(<[^>]+>)?/g, '')
    // Handle useState, useEffect, etc.
    .replace(/React\.(useState|useEffect|useCallback|useMemo|useRef)/g, '$1');

  // If no App function found, wrap in one
  if (!transformed.includes('function App') && !transformed.includes('const App')) {
    transformed = `function App() { return (${transformed}); }`;
  }

  return transformed;
}
