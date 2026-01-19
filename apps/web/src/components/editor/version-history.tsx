'use client';

import { useState, useEffect } from 'react';
import { History, RotateCcw, Clock, Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface VersionHistoryProps {
  projectId: string;
  fileId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
}

interface Snapshot {
  id: string;
  name: string;
  created_at: string;
  created_by?: string;
}

interface FileVersion {
  id: string;
  version_number: number;
  created_at: string;
  message?: string;
}

export function VersionHistory({ projectId, fileId, isOpen, onClose, onRestore }: VersionHistoryProps) {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'versions'>('snapshots');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, activeTab, fileId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'snapshots') {
        const res = await fetch(`/api/versions?projectId=${projectId}&type=snapshot`);
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      } else if (fileId) {
        const res = await fetch(`/api/versions?fileId=${fileId}&type=file`);
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async () => {
    if (!snapshotName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_snapshot',
          projectId,
          name: snapshotName,
        }),
      });

      if (res.ok) {
        setSnapshotName('');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    } finally {
      setCreating(false);
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    setRestoring(snapshotId);
    try {
      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_snapshot',
          projectId,
          snapshotId,
        }),
      });

      if (res.ok) {
        onRestore();
        onClose();
      }
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    } finally {
      setRestoring(null);
    }
  };

  const restoreFileVersion = async (versionId: string) => {
    if (!fileId) return;

    setRestoring(versionId);
    try {
      const res = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_file_version',
          fileId,
          versionId,
        }),
      });

      if (res.ok) {
        onRestore();
        onClose();
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
    } finally {
      setRestoring(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-lg border border-gray-800 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Version History</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('snapshots')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'snapshots'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            )}
          >
            Project Snapshots
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            disabled={!fileId}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'versions'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white',
              !fileId && 'opacity-50 cursor-not-allowed'
            )}
          >
            File Versions
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'snapshots' && (
            <>
              {/* Create Snapshot */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="Snapshot name..."
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={createSnapshot}
                  disabled={creating || !snapshotName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>

              {/* Snapshots List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No snapshots yet</p>
                  <p className="text-sm text-gray-500">Create a snapshot to save your progress</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{snapshot.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreSnapshot(snapshot.id)}
                        disabled={restoring === snapshot.id}
                        className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-1.5"
                      >
                        {restoring === snapshot.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'versions' && (
            <>
              {!fileId ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Select a file to view its version history</p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No version history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">
                          Version {version.version_number}
                          {index === 0 && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {version.message || formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {index > 0 && (
                        <button
                          onClick={() => restoreFileVersion(version.id)}
                          disabled={restoring === version.id}
                          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-1.5"
                        >
                          {restoring === version.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
