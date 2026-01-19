'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface File {
  path: string;
}

interface FileTabsProps {
  tabs: string[];
  activeTab: string | null;
  onSelectTab: (path: string | null) => void;
  onCloseTab: (path: string) => void;
  files: File[];
}

export function FileTabs({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  files,
}: FileTabsProps) {
  if (tabs.length === 0) {
    return (
      <div className="h-9 bg-gray-900 border-b border-gray-800" />
    );
  }

  return (
    <div className="h-9 bg-gray-900 border-b border-gray-800 flex items-center overflow-x-auto">
      {tabs.map((path) => {
        const fileName = path.split('/').pop();
        const isActive = path === activeTab;

        return (
          <div
            key={path}
            className={cn(
              'group flex items-center gap-2 h-full px-3 border-r border-gray-800 cursor-pointer transition-colors min-w-0',
              isActive
                ? 'bg-gray-950 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            )}
            onClick={() => onSelectTab(path)}
          >
            <span className="text-sm truncate max-w-[120px]">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(path);
              }}
              className={cn(
                'p-0.5 rounded hover:bg-gray-700 transition-colors flex-shrink-0',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
