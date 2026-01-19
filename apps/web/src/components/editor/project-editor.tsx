'use client';

import { useState, useCallback } from 'react';
import { ChatPanel } from './chat-panel';
import { CodePanel } from './code-panel';
import { PreviewPanel } from './preview-panel';
import { EditorHeader } from './editor-header';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

interface File {
  id?: string;
  path: string;
  content: string | null;
  language?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  files_changed?: string[];
  created_at: string;
}

interface ProjectEditorProps {
  project: any;
  files: File[];
  conversation: any;
  messages: Message[];
  userRole: string;
}

export function ProjectEditor({
  project,
  files: initialFiles,
  conversation,
  messages: initialMessages,
  userRole,
}: ProjectEditorProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedFile, setSelectedFile] = useState<string | null>(
    files.find((f) => f.path === 'src/App.tsx')?.path ||
      files.find((f) => !f.path.includes('/'))?.path ||
      files[0]?.path ||
      null
  );
  const [previewKey, setPreviewKey] = useState(0);

  const canEdit = ['owner', 'admin', 'editor'].includes(userRole);

  // Handle file updates from AI
  const handleFilesUpdate = useCallback((updatedFiles: File[]) => {
    setFiles((prev) => {
      const fileMap = new Map(prev.map((f) => [f.path, f]));
      updatedFiles.forEach((f) => fileMap.set(f.path, f));
      return Array.from(fileMap.values());
    });
    // Trigger preview refresh
    setPreviewKey((k) => k + 1);
  }, []);

  // Handle new message
  const handleNewMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Handle file content change from editor
  const handleFileChange = useCallback((path: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content } : f))
    );
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <EditorHeader project={project} />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <ChatPanel
            projectId={project.id}
            conversationId={conversation?.id}
            messages={messages}
            onNewMessage={handleNewMessage}
            onFilesUpdate={handleFilesUpdate}
            disabled={!canEdit}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Code Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <CodePanel
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onFileChange={handleFileChange}
            readOnly={!canEdit}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Preview Panel */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <PreviewPanel key={previewKey} projectId={project.id} files={files} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
