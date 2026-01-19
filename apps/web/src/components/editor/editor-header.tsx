'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Share2,
  Settings,
  Github,
  Cloud,
  MoreHorizontal,
  Globe,
  Lock,
} from 'lucide-react';
import { useState } from 'react';

interface EditorHeaderProps {
  project: any;
}

export function EditorHeader({ project }: EditorHeaderProps) {
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    setDeploying(true);
    // TODO: Implement deployment
    setTimeout(() => setDeploying(false), 2000);
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      {/* Left */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/projects"
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{project.name}</span>
          {project.is_public ? (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded">
              <Globe className="w-3 h-3" />
              Public
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              <Lock className="w-3 h-3" />
              Private
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Cloud className="w-4 h-4" />
          <span>{deploying ? 'Deploying...' : 'Deploy'}</span>
        </button>

        <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
