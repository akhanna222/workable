'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileData {
  id?: string;
  path: string;
  content: string | null;
}

interface FileTreeProps {
  files: FileData[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  content?: string | null;
}

export function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  // Build tree structure from flat file list
  const tree = useMemo(() => {
    const root: TreeNode = {
      name: '',
      path: '',
      isDirectory: true,
      children: [],
    };

    files.forEach((file) => {
      const parts = file.path.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const existingChild = current.children.find((c) => c.name === part);

        if (existingChild) {
          current = existingChild;
        } else {
          const newNode: TreeNode = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            isDirectory: !isLast,
            children: [],
            content: isLast ? file.content : undefined,
          };
          current.children.push(newNode);
          current = newNode;
        }
      });
    });

    // Sort: directories first, then alphabetically
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root.children;
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-gray-500 text-sm">
        No files yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}

function TreeNodeComponent({
  node,
  selectedFile,
  onSelectFile,
  depth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isSelected = selectedFile === node.path;

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-800 transition-colors',
            'text-gray-400 hover:text-white'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Get file icon color based on extension
  const getFileIconColor = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const colors: Record<string, string> = {
      tsx: 'text-blue-400',
      ts: 'text-blue-400',
      jsx: 'text-yellow-400',
      js: 'text-yellow-400',
      css: 'text-purple-400',
      html: 'text-orange-400',
      json: 'text-yellow-300',
      md: 'text-gray-400',
    };
    return colors[ext || ''] || 'text-gray-500';
  };

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        'w-full flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors',
        isSelected
          ? 'bg-blue-600/20 text-blue-400'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <div className="w-4 h-4 flex-shrink-0" /> {/* Spacer for alignment */}
      <File className={cn('w-4 h-4 flex-shrink-0', getFileIconColor(node.name))} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
