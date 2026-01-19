'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, StopCircle, Bot, Code, Database, Server, Cloud, CheckCircle2, Search } from 'lucide-react';
import { ChatMessage } from './chat-message';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  files_changed?: string[];
  created_at: string;
}

interface File {
  id?: string;
  path: string;
  content: string | null;
  language?: string | null;
}

interface AgentEvent {
  type: 'agent_start' | 'agent_complete' | 'task_start' | 'task_complete';
  agentRole: string;
  message: string;
}

interface ChatPanelProps {
  projectId: string;
  conversationId: string | null;
  messages: Message[];
  onNewMessage: (message: Message) => void;
  onFilesUpdate: (files: File[]) => void;
  disabled?: boolean;
}

// Agent role display configuration
const AGENT_CONFIG: Record<string, { icon: React.ElementType; color: string; name: string }> = {
  orchestrator: { icon: Bot, color: 'text-purple-400', name: 'Project Architect' },
  ui: { icon: Code, color: 'text-blue-400', name: 'UI Engineer' },
  backend: { icon: Server, color: 'text-green-400', name: 'Backend Engineer' },
  database: { icon: Database, color: 'text-yellow-400', name: 'Database Architect' },
  devops: { icon: Cloud, color: 'text-orange-400', name: 'DevOps Engineer' },
  reviewer: { icon: Search, color: 'text-pink-400', name: 'Code Reviewer' },
};

export function ChatPanel({
  projectId,
  conversationId,
  messages,
  onNewMessage,
  onFilesUpdate,
  disabled = false,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, agentEvents, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || disabled) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    onNewMessage(userMessage);
    setInput('');
    setIsGenerating(true);
    setStreamingContent('');
    setAgentEvents([]);
    setActiveAgent(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          conversationId,
          message: userMessage.content,
          history: messages.slice(-10), // Last 10 messages for context
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let filesUpdated: File[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'text') {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            } else if (parsed.type === 'files') {
              filesUpdated = parsed.files;
              onFilesUpdate(filesUpdated);
            } else if (parsed.type === 'event') {
              const event = parsed.event as AgentEvent;
              setAgentEvents((prev) => [...prev, event]);
              if (event.type === 'agent_start' || event.type === 'task_start') {
                setActiveAgent(event.agentRole);
              } else if (event.type === 'agent_complete') {
                setActiveAgent(null);
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        files_changed: filesUpdated.map((f) => f.path),
        created_at: new Date().toISOString(),
      };
      onNewMessage(assistantMessage);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        onNewMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
          created_at: new Date().toISOString(),
        });
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      setActiveAgent(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setStreamingContent('');
    setAgentEvents([]);
    setActiveAgent(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-gray-800">
        <Sparkles className="w-4 h-4 text-blue-400 mr-2" />
        <span className="font-medium text-white">AI Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <WelcomeMessage onSuggestionClick={handleSuggestionClick} />
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {/* Streaming message */}
        {isGenerating && streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Agent Status Display */}
        {isGenerating && agentEvents.length > 0 && (
          <AgentStatusDisplay events={agentEvents} activeAgent={activeAgent} />
        )}

        {/* Loading indicator (only shown before any agent events) */}
        {isGenerating && !streamingContent && agentEvents.length === 0 && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analyzing request...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "You don't have edit access"
                : 'Describe what you want to build...'
            }
            disabled={disabled || isGenerating}
            className={cn(
              'w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-xl',
              'text-white placeholder-gray-500 resize-none',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[48px] max-h-[200px]'
            )}
            rows={1}
          />

          {isGenerating ? (
            <button
              type="button"
              onClick={handleStop}
              className="absolute right-3 bottom-3 p-1.5 text-red-400 hover:text-red-300 transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || disabled}
              className={cn(
                'absolute right-3 bottom-3 p-1.5 rounded-lg transition-colors',
                input.trim() && !disabled
                  ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                  : 'text-gray-600 cursor-not-allowed'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>

        <p className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function AgentStatusDisplay({
  events,
  activeAgent,
}: {
  events: AgentEvent[];
  activeAgent: string | null;
}) {
  // Get unique agents that have been involved
  const involvedAgents = Array.from(new Set(events.map(e => e.agentRole)));

  // Get the latest event for each agent
  const latestEventByAgent = events.reduce((acc, event) => {
    acc[event.agentRole] = event;
    return acc;
  }, {} as Record<string, AgentEvent>);

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Multi-Agent Team at Work</span>
      </div>

      <div className="space-y-2">
        {involvedAgents.map((agentRole) => {
          const config = AGENT_CONFIG[agentRole] || { icon: Bot, color: 'text-gray-400', name: agentRole };
          const Icon = config.icon;
          const latestEvent = latestEventByAgent[agentRole];
          const isActive = activeAgent === agentRole;
          const isCompleted = latestEvent?.type === 'agent_complete' || latestEvent?.type === 'task_complete';

          return (
            <div
              key={agentRole}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                isActive ? 'bg-gray-800 border border-gray-700' : 'bg-transparent'
              )}
            >
              <div className={cn('flex-shrink-0', config.color)}>
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-white' : 'text-gray-400'
                  )}>
                    {config.name}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                      Working
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {latestEvent?.message || 'Waiting...'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {activeAgent && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeMessage({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  const suggestions = [
    'Build a todo app with categories and due dates',
    'Create a dashboard with charts and data tables',
    'Make a landing page for a SaaS product',
  ];

  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">
        What would you like to build?
      </h3>
      <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
        Describe your app idea and I&apos;ll help you create it. Be as detailed as
        you&apos;d like!
      </p>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="block w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            &quot;{suggestion}&quot;
          </button>
        ))}
      </div>
    </div>
  );
}
