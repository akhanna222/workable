// GitHub Export Service - Export project to GitHub repository
import { ProjectFile } from './file-service';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  default_branch: string;
}

export interface ExportOptions {
  repoName: string;
  description?: string;
  isPrivate?: boolean;
  branch?: string;
  commitMessage?: string;
}

class GitHubService {
  // Create a new repository
  async createRepository(
    options: ExportOptions,
    githubToken: string
  ): Promise<GitHubRepo> {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        name: options.repoName,
        description: options.description || 'Created with BuilderAI',
        private: options.isPrivate ?? false,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create repository');
    }

    return response.json();
  }

  // Get user's repositories
  async getUserRepos(githubToken: string): Promise<GitHubRepo[]> {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    return response.json();
  }

  // Export files to a repository
  async exportToRepository(
    files: ProjectFile[],
    repo: GitHubRepo,
    options: ExportOptions,
    githubToken: string
  ): Promise<{ success: boolean; commitUrl: string }> {
    const branch = options.branch || repo.default_branch;

    // Get the current tree SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${repo.full_name}/git/refs/heads/${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    let baseSha: string;
    let baseTreeSha: string;

    if (refResponse.ok) {
      const refData = await refResponse.json();
      baseSha = refData.object.sha;

      // Get the commit to find tree SHA
      const commitResponse = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/commits/${baseSha}`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      const commitData = await commitResponse.json();
      baseTreeSha = commitData.tree.sha;
    } else {
      // New repo, need to create initial commit
      baseSha = '';
      baseTreeSha = '';
    }

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${repo.full_name}/contents/${file.path}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              message: options.commitMessage || 'Update from BuilderAI',
              content: Buffer.from(file.content).toString('base64'),
              branch,
            }),
          }
        );

        if (!blobResponse.ok) {
          const error = await blobResponse.json();
          console.error(`Failed to upload ${file.path}:`, error);
        }

        return blobResponse.json();
      })
    );

    // Get the commit URL from the last successful upload
    const lastBlob = blobs[blobs.length - 1];
    return {
      success: true,
      commitUrl: lastBlob?.commit?.html_url || repo.html_url,
    };
  }

  // Export as a single commit with tree (more efficient for many files)
  async exportAsTree(
    files: ProjectFile[],
    repo: GitHubRepo,
    options: ExportOptions,
    githubToken: string
  ): Promise<{ success: boolean; commitUrl: string }> {
    const branch = options.branch || repo.default_branch;
    const headers = {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    };

    // Get the latest commit SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${repo.full_name}/git/refs/heads/${branch}`,
      { headers }
    );

    if (!refResponse.ok) {
      throw new Error('Failed to get branch reference');
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Create blobs for all files
    const treeItems = await Promise.all(
      files.map(async (file) => {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${repo.full_name}/git/blobs`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8',
            }),
          }
        );

        const blob = await blobResponse.json();
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // Create a new tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${repo.full_name}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base_tree: baseSha,
          tree: treeItems,
        }),
      }
    );

    const tree = await treeResponse.json();

    // Create a commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${repo.full_name}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: options.commitMessage || 'Export from BuilderAI',
          tree: tree.sha,
          parents: [baseSha],
        }),
      }
    );

    const commit = await commitResponse.json();

    // Update the reference
    await fetch(
      `https://api.github.com/repos/${repo.full_name}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: commit.sha,
        }),
      }
    );

    return {
      success: true,
      commitUrl: `${repo.html_url}/commit/${commit.sha}`,
    };
  }

  // Generate downloadable project zip
  generateDownloadableProject(files: ProjectFile[]): Blob {
    // Create package.json if not exists
    const hasPackageJson = files.some(f => f.path === 'package.json');
    const projectFiles = [...files];

    if (!hasPackageJson) {
      projectFiles.push({
        project_id: '',
        path: 'package.json',
        content: JSON.stringify({
          name: 'builderai-project',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            '@vitejs/plugin-react': '^4.0.0',
            typescript: '^5.0.0',
            vite: '^5.0.0',
            tailwindcss: '^3.4.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
        }, null, 2),
        language: 'json',
      });
    }

    // Create a simple text representation (in production, use JSZip)
    const content = projectFiles
      .map(f => `=== ${f.path} ===\n${f.content}`)
      .join('\n\n');

    return new Blob([content], { type: 'text/plain' });
  }
}

export const githubService = new GitHubService();
