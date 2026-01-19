'use client';

import { useState } from 'react';
import { Rocket, ExternalLink, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeployDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

type Provider = 'vercel' | 'netlify';

export function DeployDialog({ projectId, projectName, isOpen, onClose }: DeployDialogProps) {
  const [provider, setProvider] = useState<Provider>('vercel');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (!token.trim()) {
      setError('Please enter your API token');
      return;
    }

    setStatus('deploying');
    setError(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          provider,
          token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      // Poll for deployment status
      if (data.status === 'building') {
        await pollDeploymentStatus(data.id, token);
      } else {
        setDeployUrl(data.url);
        setStatus('success');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const pollDeploymentStatus = async (deploymentId: string, apiToken: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await fetch(
        `/api/deploy?id=${deploymentId}&provider=${provider}`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );

      const data = await response.json();

      if (data.status === 'ready') {
        setDeployUrl(data.url);
        setStatus('success');
        return;
      }

      if (data.status === 'error') {
        throw new Error(data.errorMessage || 'Deployment failed');
      }

      attempts++;
    }

    throw new Error('Deployment timed out');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Deploy Project</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {status === 'success' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Deployed Successfully!</h3>
              <p className="text-gray-400 mb-4">Your app is now live</p>
              {deployUrl && (
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Open Site <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deploy to
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProvider('vercel')}
                    className={cn(
                      'p-3 rounded-lg border flex items-center justify-center gap-2 transition-colors',
                      provider === 'vercel'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 116 100" fill="currentColor">
                      <path d="M57.5 0L115 100H0L57.5 0z" />
                    </svg>
                    Vercel
                  </button>
                  <button
                    onClick={() => setProvider('netlify')}
                    className={cn(
                      'p-3 rounded-lg border flex items-center justify-center gap-2 transition-colors',
                      provider === 'netlify'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
                      <path d="M153.094 165.376l-62.098-36.216 62.098-36.216v72.432z" />
                    </svg>
                    Netlify
                  </button>
                </div>
              </div>

              {/* API Token */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {provider === 'vercel' ? 'Vercel' : 'Netlify'} API Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your API token"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Get your token from{' '}
                  <a
                    href={provider === 'vercel' ? 'https://vercel.com/account/tokens' : 'https://app.netlify.com/user/applications#personal-access-tokens'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {provider === 'vercel' ? 'Vercel Settings' : 'Netlify Settings'}
                  </a>
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Deploy Button */}
              <button
                onClick={handleDeploy}
                disabled={status === 'deploying'}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'deploying' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Deploy to {provider === 'vercel' ? 'Vercel' : 'Netlify'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
