'use client';

import { useState } from 'react';
import { FileTree } from './file-tree';
import { CodeEditor } from './code-editor';
import { FileTabs } from './file-tabs';
import { getLanguageFromPath } from '@/lib/utils';

interface File {
  id?: string;
  path: string;
  content: string | null;
  language?: string | null;
}

interface CodePanelProps {
  files: File[];
  selectedFile: string | null;
  onSelectFile: (path: string | null) => void;
  onFileChange: (path: string, content: string) => void;
  readOnly?: boolean;
}

export function CodePanel({
  files,
  selectedFile,
  onSelectFile,
  onFileChange,
  readOnly = false,
}: CodePanelProps) {
  const [openTabs, setOpenTabs] = useState<string[]>(
    selectedFile ? [selectedFile] : []
  );

  const handleSelectFile = (path: string) => {
    onSelectFile(path);
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
  };

  const handleCloseTab = (path: string) => {
    setOpenTabs((prev) => prev.filter((p) => p !== path));
    if (selectedFile === path) {
      const remaining = openTabs.filter((p) => p !== path);
      onSelectFile(remaining[remaining.length - 1] || null);
    }
  };

  const currentFile = files.find((f) => f.path === selectedFile);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Tabs */}
      <FileTabs
        tabs={openTabs}
        activeTab={selectedFile}
        onSelectTab={onSelectFile}
        onCloseTab={handleCloseTab}
        files={files}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Sidebar */}
        <div className="w-56 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-500 uppercase">
              Explorer
            </div>
            <FileTree
              files={files}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {currentFile ? (
            <CodeEditor
              path={currentFile.path}
              content={currentFile.content || ''}
              language={getLanguageFromPath(currentFile.path)}
              onChange={(content) => onFileChange(currentFile.path, content)}
              readOnly={readOnly}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No file selected</p>
                <p className="text-sm">Select a file from the explorer to edit</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
