// Real-time Collaboration Service using Supabase Realtime
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  cursor?: { line: number; column: number };
  selectedFile?: string;
  color: string;
}

export interface FileChange {
  path: string;
  content: string;
  userId: string;
  timestamp: number;
}

export interface CursorPosition {
  userId: string;
  file: string;
  line: number;
  column: number;
}

type CollaboratorCallback = (collaborators: Collaborator[]) => void;
type FileChangeCallback = (change: FileChange) => void;
type CursorCallback = (cursor: CursorPosition) => void;

// Random colors for collaborators
const COLLABORATOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
];

class RealtimeService {
  private supabase = createClient();
  private channels: Map<string, RealtimeChannel> = new Map();
  private collaborators: Map<string, Map<string, Collaborator>> = new Map();
  private callbacks: Map<string, {
    collaborators: CollaboratorCallback[];
    fileChanges: FileChangeCallback[];
    cursors: CursorCallback[];
  }> = new Map();

  // Join a project's real-time channel
  async joinProject(
    projectId: string,
    userId: string,
    userInfo: { name: string; email: string; avatar?: string }
  ): Promise<void> {
    if (this.channels.has(projectId)) {
      return; // Already joined
    }

    const channel = this.supabase.channel(`project:${projectId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Track presence (who's online)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const collabs = this.parsePresenceState(state);
        this.collaborators.set(projectId, collabs);
        this.notifyCollaborators(projectId, Array.from(collabs.values()));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      });

    // Listen for file changes
    channel.on('broadcast', { event: 'file_change' }, ({ payload }) => {
      const change = payload as FileChange;
      this.notifyFileChange(projectId, change);
    });

    // Listen for cursor movements
    channel.on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
      const cursor = payload as CursorPosition;
      this.notifyCursor(projectId, cursor);

      // Update collaborator's cursor
      const collabs = this.collaborators.get(projectId);
      if (collabs) {
        const collab = collabs.get(cursor.userId);
        if (collab) {
          collab.cursor = { line: cursor.line, column: cursor.column };
          collab.selectedFile = cursor.file;
          this.notifyCollaborators(projectId, Array.from(collabs.values()));
        }
      }
    });

    // Subscribe to the channel
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track our presence
        await channel.track({
          user_id: userId,
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.avatar,
          color: this.getRandomColor(),
          online_at: new Date().toISOString(),
        });
      }
    });

    this.channels.set(projectId, channel);
    this.callbacks.set(projectId, { collaborators: [], fileChanges: [], cursors: [] });
  }

  // Leave a project channel
  async leaveProject(projectId: string): Promise<void> {
    const channel = this.channels.get(projectId);
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(projectId);
      this.collaborators.delete(projectId);
      this.callbacks.delete(projectId);
    }
  }

  // Broadcast a file change
  async broadcastFileChange(projectId: string, change: FileChange): Promise<void> {
    const channel = this.channels.get(projectId);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'file_change',
        payload: change,
      });
    }
  }

  // Broadcast cursor position
  async broadcastCursor(projectId: string, cursor: CursorPosition): Promise<void> {
    const channel = this.channels.get(projectId);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: cursor,
      });
    }
  }

  // Subscribe to collaborator changes
  onCollaboratorsChange(projectId: string, callback: CollaboratorCallback): () => void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.collaborators.push(callback);
      // Send current state immediately
      const collabs = this.collaborators.get(projectId);
      if (collabs) {
        callback(Array.from(collabs.values()));
      }
    }

    return () => {
      if (cbs) {
        const idx = cbs.collaborators.indexOf(callback);
        if (idx !== -1) {
          cbs.collaborators.splice(idx, 1);
        }
      }
    };
  }

  // Subscribe to file changes
  onFileChange(projectId: string, callback: FileChangeCallback): () => void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.fileChanges.push(callback);
    }

    return () => {
      if (cbs) {
        const idx = cbs.fileChanges.indexOf(callback);
        if (idx !== -1) {
          cbs.fileChanges.splice(idx, 1);
        }
      }
    };
  }

  // Subscribe to cursor movements
  onCursorMove(projectId: string, callback: CursorCallback): () => void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.cursors.push(callback);
    }

    return () => {
      if (cbs) {
        const idx = cbs.cursors.indexOf(callback);
        if (idx !== -1) {
          cbs.cursors.splice(idx, 1);
        }
      }
    };
  }

  // Get current collaborators
  getCollaborators(projectId: string): Collaborator[] {
    const collabs = this.collaborators.get(projectId);
    return collabs ? Array.from(collabs.values()) : [];
  }

  private parsePresenceState(state: Record<string, any[]>): Map<string, Collaborator> {
    const result = new Map<string, Collaborator>();

    for (const [userId, presences] of Object.entries(state)) {
      if (presences.length > 0) {
        const presence = presences[0];
        result.set(userId, {
          id: userId,
          name: presence.name || 'Anonymous',
          email: presence.email || '',
          avatar: presence.avatar,
          color: presence.color || this.getRandomColor(),
        });
      }
    }

    return result;
  }

  private notifyCollaborators(projectId: string, collaborators: Collaborator[]): void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.collaborators.forEach(cb => cb(collaborators));
    }
  }

  private notifyFileChange(projectId: string, change: FileChange): void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.fileChanges.forEach(cb => cb(change));
    }
  }

  private notifyCursor(projectId: string, cursor: CursorPosition): void {
    const cbs = this.callbacks.get(projectId);
    if (cbs) {
      cbs.cursors.forEach(cb => cb(cursor));
    }
  }

  private getRandomColor(): string {
    return COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];
  }
}

export const realtimeService = new RealtimeService();
