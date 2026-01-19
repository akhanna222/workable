'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FolderKanban,
  Settings,
  Plus,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  user: Profile | null;
  workspaces: Workspace[];
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar({ user, workspaces }: SidebarProps) {
  const pathname = usePathname();
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0]);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
          <span className="text-xl font-bold text-white">BuilderAI</span>
        </Link>
      </div>

      {/* Workspace Selector */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-medium text-white">
                {selectedWorkspace?.name?.[0]?.toUpperCase() || 'W'}
              </div>
              <span className="text-sm font-medium text-white truncate">
                {selectedWorkspace?.name || 'Select Workspace'}
              </span>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-gray-400" />
          </button>

          {workspaceDropdownOpen && workspaces.length > 1 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    setSelectedWorkspace(workspace);
                    setWorkspaceDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors',
                    selectedWorkspace?.id === workspace.id && 'bg-gray-700'
                  )}
                >
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-medium text-white">
                    {workspace.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white truncate">{workspace.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* New Project Button */}
      <div className="p-3 border-t border-gray-800">
        <Link
          href="/dashboard/projects/new"
          className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* User */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-white">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.full_name || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
