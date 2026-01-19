'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, X, Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor?: { line: number; column: number };
  selectedFile?: string;
}

interface CollaboratorsProps {
  projectId: string;
  collaborators: Collaborator[];
  currentUserId: string;
}

export function Collaborators({ projectId, collaborators, currentUserId }: CollaboratorsProps) {
  const [showInvite, setShowInvite] = useState(false);

  // Filter out current user
  const otherCollaborators = collaborators.filter((c) => c.id !== currentUserId);

  if (otherCollaborators.length === 0) {
    return (
      <button
        onClick={() => setShowInvite(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Invite
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {otherCollaborators.slice(0, 4).map((collaborator) => (
          <div
            key={collaborator.id}
            className="relative group"
            title={collaborator.name}
          >
            <div
              className="w-8 h-8 rounded-full border-2 border-gray-900 flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.avatar ? (
                <img
                  src={collaborator.avatar}
                  alt={collaborator.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                collaborator.name.charAt(0).toUpperCase()
              )}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />

            {/* Tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
              {collaborator.name}
              {collaborator.selectedFile && (
                <span className="text-gray-400 block">
                  Editing: {collaborator.selectedFile.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        ))}
        {otherCollaborators.length > 4 && (
          <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs font-medium text-white">
            +{otherCollaborators.length - 4}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowInvite(true)}
        className="p-1.5 text-gray-400 hover:text-white transition-colors"
        title="Invite collaborator"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal projectId={projectId} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

function InviteModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/projects/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email, role }),
      });

      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md border border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Invite Collaborator</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {sent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-white font-medium">Invitation sent!</p>
              <p className="text-sm text-gray-400">They'll receive an email shortly</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRole('editor')}
                    className={cn(
                      'p-3 rounded-lg border text-sm transition-colors',
                      role === 'editor'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    <strong>Editor</strong>
                    <p className="text-xs opacity-75">Can edit files and chat</p>
                  </button>
                  <button
                    onClick={() => setRole('viewer')}
                    className={cn(
                      'p-3 rounded-lg border text-sm transition-colors',
                      role === 'viewer'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    <strong>Viewer</strong>
                    <p className="text-xs opacity-75">Can only view project</p>
                  </button>
                </div>
              </div>

              <button
                onClick={handleInvite}
                disabled={sending || !email.trim()}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Invitation
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

// Cursor indicator for remote collaborators
export function RemoteCursor({
  collaborator,
  position,
}: {
  collaborator: Collaborator;
  position: { top: number; left: number };
}) {
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{ top: position.top, left: position.left }}
    >
      <svg
        width="15"
        height="20"
        viewBox="0 0 15 20"
        fill="none"
        style={{ color: collaborator.color }}
      >
        <path
          d="M0.5 0.5L14.5 11.5L7.5 12.5L5 19.5L0.5 0.5Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <div
        className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name}
      </div>
    </div>
  );
}
