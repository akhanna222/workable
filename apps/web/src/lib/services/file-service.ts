// File Persistence Service - Save and load files from Supabase
import { createClient } from '@/lib/supabase/client';

export interface ProjectFile {
  id?: string;
  project_id: string;
  path: string;
  content: string;
  language: string;
  created_at?: string;
  updated_at?: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  content: string;
  version_number: number;
  created_at: string;
  created_by?: string;
  message?: string;
}

class FileService {
  private supabase = createClient();

  // Get all files for a project
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    const { data, error } = await this.supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('path');

    if (error) throw error;
    return data || [];
  }

  // Get a single file by path
  async getFile(projectId: string, path: string): Promise<ProjectFile | null> {
    const { data, error } = await this.supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .eq('path', path)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Create or update a file
  async saveFile(file: Omit<ProjectFile, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectFile> {
    const existing = await this.getFile(file.project_id, file.path);

    if (existing) {
      // Update existing file
      const { data, error } = await this.supabase
        .from('files')
        .update({
          content: file.content,
          language: file.language,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      // Create version snapshot
      await this.createVersion(existing.id!, file.content, `Updated ${file.path}`);

      return data;
    } else {
      // Create new file
      const { data, error } = await this.supabase
        .from('files')
        .insert({
          project_id: file.project_id,
          path: file.path,
          content: file.content,
          language: file.language,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial version
      await this.createVersion(data.id, file.content, `Created ${file.path}`);

      return data;
    }
  }

  // Save multiple files at once
  async saveFiles(files: Omit<ProjectFile, 'id' | 'created_at' | 'updated_at'>[]): Promise<ProjectFile[]> {
    const results: ProjectFile[] = [];
    for (const file of files) {
      const saved = await this.saveFile(file);
      results.push(saved);
    }
    return results;
  }

  // Delete a file
  async deleteFile(projectId: string, path: string): Promise<void> {
    const { error } = await this.supabase
      .from('files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path);

    if (error) throw error;
  }

  // Create a version snapshot
  async createVersion(fileId: string, content: string, message?: string): Promise<FileVersion> {
    // Get current version number
    const { data: versions } = await this.supabase
      .from('file_versions')
      .select('version_number')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version_number || 0) + 1;

    const { data, error } = await this.supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        content,
        version_number: nextVersion,
        message,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get file versions
  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    const { data, error } = await this.supabase
      .from('file_versions')
      .select('*')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Restore a file to a specific version
  async restoreVersion(fileId: string, versionId: string): Promise<ProjectFile> {
    // Get the version content
    const { data: version, error: versionError } = await this.supabase
      .from('file_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError) throw versionError;

    // Update the file
    const { data, error } = await this.supabase
      .from('files')
      .update({
        content: version.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select()
      .single();

    if (error) throw error;

    // Create a new version marking the restore
    await this.createVersion(fileId, version.content, `Restored to version ${version.version_number}`);

    return data;
  }

  // Create a project snapshot (all files)
  async createProjectSnapshot(projectId: string, name: string): Promise<{ id: string; name: string; created_at: string }> {
    const files = await this.getProjectFiles(projectId);

    const { data, error } = await this.supabase
      .from('project_snapshots')
      .insert({
        project_id: projectId,
        name,
        files: files.map(f => ({ path: f.path, content: f.content, language: f.language })),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get project snapshots
  async getProjectSnapshots(projectId: string): Promise<{ id: string; name: string; created_at: string }[]> {
    const { data, error } = await this.supabase
      .from('project_snapshots')
      .select('id, name, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Restore project from snapshot
  async restoreProjectSnapshot(projectId: string, snapshotId: string): Promise<ProjectFile[]> {
    const { data: snapshot, error: snapshotError } = await this.supabase
      .from('project_snapshots')
      .select('files')
      .eq('id', snapshotId)
      .single();

    if (snapshotError) throw snapshotError;

    // Delete current files
    await this.supabase
      .from('files')
      .delete()
      .eq('project_id', projectId);

    // Restore files from snapshot
    const files = snapshot.files as { path: string; content: string; language: string }[];
    const restoredFiles: ProjectFile[] = [];

    for (const file of files) {
      const saved = await this.saveFile({
        project_id: projectId,
        path: file.path,
        content: file.content,
        language: file.language,
      });
      restoredFiles.push(saved);
    }

    return restoredFiles;
  }
}

export const fileService = new FileService();
