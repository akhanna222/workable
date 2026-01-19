'use client';

import { User, Bot, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  files_changed?: string[];
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-blue-600' : 'bg-gray-700'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 space-y-2 max-w-[85%]',
          isUser && 'flex flex-col items-end'
        )}
      >
        <div
          className={cn(
            'px-4 py-2 rounded-2xl',
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-800 text-gray-100 rounded-tl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <MessageContent content={message.content} />
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
          )}
        </div>

        {/* Files changed indicator */}
        {message.files_changed && message.files_changed.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Check className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">
              {message.files_changed.length} file(s) updated
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Parse the content to handle code blocks and file markers
  const parts = parseContent(content);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <pre
              key={index}
              className="bg-gray-900 rounded-lg p-3 overflow-x-auto text-sm"
            >
              <code className="text-gray-300">{part.content}</code>
            </pre>
          );
        }
        if (part.type === 'file') {
          return (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-3 border border-gray-700"
            >
              <div className="text-xs text-gray-500 mb-2 font-mono">
                {part.path}
              </div>
              <pre className="overflow-x-auto text-sm">
                <code className="text-gray-300">{part.content}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {part.content}
          </p>
        );
      })}
    </>
  );
}

interface ContentPart {
  type: 'text' | 'code' | 'file';
  content: string;
  path?: string;
  language?: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let remaining = content;

  // Match file blocks: <file path="...">...</file>
  const fileRegex = /<file path="([^"]+)">\n?([\s\S]*?)\n?<\/file>/g;
  // Match code blocks: ```language\n...\n```
  const codeRegex = /```(\w*)\n?([\s\S]*?)\n?```/g;

  let lastIndex = 0;
  let match;

  // First, extract file blocks
  const allMatches: { start: number; end: number; part: ContentPart }[] = [];

  while ((match = fileRegex.exec(content)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      part: {
        type: 'file',
        path: match[1],
        content: match[2].trim(),
      },
    });
  }

  // Reset regex
  fileRegex.lastIndex = 0;

  // Then, extract code blocks
  while ((match = codeRegex.exec(content)) !== null) {
    // Check if this overlaps with a file block
    const overlaps = allMatches.some(
      (m) => match!.index >= m.start && match!.index < m.end
    );
    if (!overlaps) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        part: {
          type: 'code',
          language: match[1] || 'text',
          content: match[2].trim(),
        },
      });
    }
  }

  // Sort by start position
  allMatches.sort((a, b) => a.start - b.start);

  // Build parts array
  for (const m of allMatches) {
    if (m.start > lastIndex) {
      const text = content.slice(lastIndex, m.start).trim();
      if (text) {
        parts.push({ type: 'text', content: text });
      }
    }
    parts.push(m.part);
    lastIndex = m.end;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      parts.push({ type: 'text', content: text });
    }
  }

  // If no special blocks found, return as single text
  if (parts.length === 0) {
    parts.push({ type: 'text', content: content });
  }

  return parts;
}
