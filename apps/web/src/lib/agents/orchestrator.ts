import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIGS, getAgentConfig } from './agent-configs';
import {
  AgentContext,
  AgentEvent,
  AgentRole,
  AgentTask,
  GeneratedFile,
  OrchestratorPlan,
  TaskResult,
} from './types';

export class MultiAgentOrchestrator {
  private anthropic: Anthropic;
  private context: AgentContext;
  private eventCallback?: (event: AgentEvent) => void;
  private generatedFiles: GeneratedFile[] = []; // Track files as they're generated

  constructor(
    apiKey: string,
    context: AgentContext,
    onEvent?: (event: AgentEvent) => void
  ) {
    this.anthropic = new Anthropic({ apiKey });
    this.context = context;
    this.eventCallback = onEvent;
    this.generatedFiles = [];
  }

  private emit(event: Omit<AgentEvent, 'timestamp'>) {
    const fullEvent: AgentEvent = {
      ...event,
      timestamp: new Date(),
    };
    this.eventCallback?.(fullEvent);
  }

  async processRequest(userMessage: string): Promise<{
    plan: OrchestratorPlan;
    files: GeneratedFile[];
    response: string;
  }> {
    // Step 1: Get the orchestrator to create a plan
    this.emit({
      type: 'agent_started',
      agentRole: 'orchestrator',
      message: 'Analyzing your request...',
    });

    let plan: OrchestratorPlan;
    try {
      plan = await this.createPlan(userMessage);
    } catch (error: any) {
      // Emit error but create a fallback plan
      this.emit({
        type: 'agent_error',
        agentRole: 'orchestrator',
        message: `Planning failed: ${error.message}. Using simplified approach.`,
      });

      // Fallback plan based on message analysis
      plan = this.createFallbackPlan(userMessage);
    }

    this.emit({
      type: 'agent_completed',
      agentRole: 'orchestrator',
      message: `Created plan with ${plan.tasks.length} task${plan.tasks.length > 1 ? 's' : ''}`,
      data: plan,
    });

    // Step 2: Execute tasks in order
    const completedTasks: AgentTask[] = [];
    const completedTaskOrders = new Set<number>();

    for (const task of plan.tasks) {
      // Check if dependencies are met
      const dependenciesMet = task.dependencies?.every((depOrder) =>
        completedTaskOrders.has(depOrder)
      ) ?? true;

      if (!dependenciesMet) {
        this.emit({
          type: 'task_skipped',
          agentRole: task.agent,
          taskId: `task-${task.order}`,
          message: `Skipped: Dependencies not met for "${task.description}"`,
        });
        continue;
      }

      this.emit({
        type: 'task_started',
        agentRole: task.agent,
        taskId: `task-${task.order}`,
        message: task.description,
      });

      this.emit({
        type: 'agent_started',
        agentRole: task.agent,
        message: `${getAgentConfig(task.agent).name} is working...`,
      });

      // Execute the task with the appropriate agent
      const result = await this.executeTask(task);

      if (result.success && result.files) {
        // Add new files to tracking and update context
        for (const file of result.files) {
          // Update or add file to generatedFiles
          const existingIndex = this.generatedFiles.findIndex(f => f.path === file.path);
          if (existingIndex >= 0) {
            this.generatedFiles[existingIndex] = file;
          } else {
            this.generatedFiles.push(file);
          }

          this.emit({
            type: file.action === 'create' ? 'file_created' : 'file_modified',
            agentRole: task.agent,
            message: `${file.action === 'create' ? 'Created' : 'Modified'}: ${file.path}`,
            data: file,
          });
        }
      }

      const agentTask: AgentTask = {
        id: `task-${task.order}`,
        type: 'create',
        description: task.description,
        assignedTo: task.agent,
        status: result.success ? 'completed' : 'failed',
        result,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      completedTasks.push(agentTask);
      if (result.success) {
        completedTaskOrders.add(task.order);
      }

      this.emit({
        type: 'task_completed',
        agentRole: task.agent,
        taskId: `task-${task.order}`,
        message: result.success
          ? `Completed: ${task.description}`
          : `Failed: ${result.error}`,
        data: result,
      });

      this.emit({
        type: 'agent_completed',
        agentRole: task.agent,
        message: `${getAgentConfig(task.agent).name} finished`,
      });
    }

    // Step 3: Generate summary response
    const response = this.generateSummary(plan, this.generatedFiles, completedTasks);

    return { plan, files: this.generatedFiles, response };
  }

  private async createPlan(userMessage: string): Promise<OrchestratorPlan> {
    const config = getAgentConfig('orchestrator');

    // Build context including existing files and conversation history
    const existingFilesContext =
      this.context.existingFiles.length > 0
        ? `\n\nExisting project files:\n${this.context.existingFiles.map((f) => `- ${f.path}`).join('\n')}`
        : '\n\nThis is a new project with no existing files.';

    // Include conversation history for multi-turn context
    const historyContext = this.context.messages && this.context.messages.length > 0
      ? `\n\nPrevious conversation:\n${this.context.messages.slice(-6).map((m: any) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${typeof m.content === 'string' ? m.content.slice(0, 500) : 'Code generated'}`
      ).join('\n')}`
      : '';

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: config.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `User request: ${userMessage}${existingFilesContext}${historyContext}\n\nCreate a detailed implementation plan as JSON. Include task dependencies if tasks need to be executed in order.`,
          },
        ],
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      // Try multiple JSON extraction patterns
      let jsonContent = '';

      // Pattern 1: ```json blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        // Pattern 2: Look for raw JSON object
        const rawJsonMatch = content.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
        if (rawJsonMatch) {
          jsonContent = rawJsonMatch[0];
        }
      }

      if (jsonContent) {
        try {
          const planData = JSON.parse(jsonContent);
          return {
            summary: planData.summary || planData.understanding || 'Building the requested feature',
            tasks: planData.tasks.map((t: any, i: number) => ({
              order: t.order || i + 1,
              agent: this.normalizeAgentRole(t.agent),
              description: t.description,
              files: t.files || [],
              dependencies: t.dependencies || [],
            })),
            estimatedFiles: planData.tasks.reduce(
              (sum: number, t: any) => sum + (t.files?.length || 1),
              0
            ),
          };
        } catch (parseError) {
          console.error('Failed to parse orchestrator plan JSON:', parseError);
          throw new Error('Invalid plan format from AI');
        }
      }

      // If no JSON found, throw to trigger fallback
      throw new Error('No valid plan found in AI response');
    } catch (error: any) {
      // Re-throw with more context
      if (error.message?.includes('Invalid plan') || error.message?.includes('No valid plan')) {
        throw error;
      }
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  private normalizeAgentRole(role: string): AgentRole {
    const roleMap: Record<string, AgentRole> = {
      'ui': 'ui',
      'ui_engineer': 'ui',
      'frontend': 'ui',
      'backend': 'backend',
      'backend_engineer': 'backend',
      'api': 'backend',
      'database': 'database',
      'database_architect': 'database',
      'db': 'database',
      'devops': 'devops',
      'devops_engineer': 'devops',
      'config': 'devops',
      'reviewer': 'reviewer',
      'code_reviewer': 'reviewer',
      'orchestrator': 'orchestrator',
    };
    return roleMap[role.toLowerCase()] || 'ui';
  }

  private createFallbackPlan(userMessage: string): OrchestratorPlan {
    const message = userMessage.toLowerCase();

    // Analyze message to determine appropriate tasks
    const tasks: OrchestratorPlan['tasks'] = [];
    let order = 1;

    // Check for database-related keywords
    if (message.includes('database') || message.includes('schema') ||
      message.includes('table') || message.includes('sql')) {
      tasks.push({
        order: order++,
        agent: 'database',
        description: `Create database schema for: ${userMessage.slice(0, 100)}`,
        files: ['src/db/schema.sql', 'src/types/database.ts'],
        dependencies: [],
      });
    }

    // Check for API/backend keywords
    if (message.includes('api') || message.includes('endpoint') ||
      message.includes('backend') || message.includes('server')) {
      tasks.push({
        order: order++,
        agent: 'backend',
        description: `Create API endpoints for: ${userMessage.slice(0, 100)}`,
        files: ['src/app/api/route.ts'],
        dependencies: tasks.length > 0 ? [tasks[tasks.length - 1].order] : [],
      });
    }

    // Always include UI task
    tasks.push({
      order: order++,
      agent: 'ui',
      description: `Create UI components for: ${userMessage.slice(0, 100)}`,
      files: ['src/App.tsx', 'src/components/Main.tsx'],
      dependencies: tasks.length > 0 ? [tasks[tasks.length - 1].order] : [],
    });

    return {
      summary: `Building feature: ${userMessage.slice(0, 100)}...`,
      tasks,
      estimatedFiles: tasks.reduce((sum, t) => sum + t.files.length, 0),
    };
  }

  private async executeTask(
    task: OrchestratorPlan['tasks'][0]
  ): Promise<TaskResult> {
    const config = getAgentConfig(task.agent);

    // Combine original project files with newly generated files for context
    const allKnownFiles = [
      ...this.context.existingFiles,
      ...this.generatedFiles,
    ];

    // Build context from relevant files
    const relevantFiles = allKnownFiles.filter((f) =>
      config.filePatterns.some((pattern) => {
        const regex = new RegExp(
          pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
        );
        return regex.test(f.path);
      })
    );

    const filesContext =
      relevantFiles.length > 0
        ? `\n\nExisting related files:\n${relevantFiles.slice(0, 5).map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join('\n\n')}`
        : '';

    const allFilesContext =
      allKnownFiles.length > 0
        ? `\n\nAll project files:\n${allKnownFiles.map((f) => `- ${f.path}`).join('\n')}`
        : '';

    try {
      this.emit({
        type: 'agent_thinking',
        agentRole: task.agent,
        message: 'Thinking...',
      });

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: config.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Task: ${task.description}\n\nExpected files to create/modify: ${task.files.join(', ')}${filesContext}${allFilesContext}\n\nGenerate the complete file contents. Use <file path="...">content</file> format for each file. Make sure to close each file tag properly.`,
          },
        ],
      });

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '';

      this.emit({
        type: 'agent_writing',
        agentRole: task.agent,
        message: 'Writing code...',
      });

      // Extract files from response
      const files = this.extractFiles(content, task.agent);

      if (files.length === 0) {
        return {
          success: false,
          error: 'No files were generated. The AI response may not have used the correct format.',
          files: [],
        };
      }

      return {
        success: true,
        files,
        message: `Created ${files.length} file(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private extractFiles(content: string, agent: AgentRole): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // More flexible regex that handles various formatting
    const fileRegex = /<file\s+path="([^"]+)">\s*([\s\S]*?)\s*<\/file>/g;

    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      const [, path, fileContent] = match;

      // Don't over-trim - preserve internal formatting but remove leading/trailing empty lines
      const cleanedContent = fileContent
        .replace(/^\n+/, '')  // Remove leading newlines only
        .replace(/\n+$/, ''); // Remove trailing newlines only

      // Determine if this is a new file or modification
      const isExisting = this.context.existingFiles.some((f) => f.path === path) ||
        this.generatedFiles.some((f) => f.path === path);

      files.push({
        path,
        content: cleanedContent,
        language: this.getLanguageFromPath(path),
        action: isExisting ? 'modify' : 'create',
      });
    }

    return files;
  }

  private getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      css: 'css',
      scss: 'scss',
      less: 'less',
      html: 'html',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      rb: 'ruby',
      php: 'php',
      sh: 'shell',
      bash: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      xml: 'xml',
      svg: 'xml',
      graphql: 'graphql',
      gql: 'graphql',
      prisma: 'prisma',
      env: 'dotenv',
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  private generateSummary(
    plan: OrchestratorPlan,
    files: GeneratedFile[],
    tasks: AgentTask[]
  ): string {
    const successCount = tasks.filter((t) => t.status === 'completed').length;
    const fileList = files.map((f) => `- ${f.path}`).join('\n');

    // Group files by action
    const createdFiles = files.filter(f => f.action === 'create');
    const modifiedFiles = files.filter(f => f.action === 'modify');

    return `## Summary

${plan.summary}

### Completed Tasks
${tasks.map((t) => `- [${t.status === 'completed' ? '✓' : '✗'}] ${t.description}`).join('\n')}

### Generated Files (${files.length})
${createdFiles.length > 0 ? `**Created:**\n${createdFiles.map(f => `- ${f.path}`).join('\n')}` : ''}
${modifiedFiles.length > 0 ? `\n**Modified:**\n${modifiedFiles.map(f => `- ${f.path}`).join('\n')}` : ''}

${successCount === tasks.length
        ? 'All tasks completed successfully!'
        : `${successCount}/${tasks.length} tasks completed.`}`;
  }
}

// Streaming version for real-time updates
export async function* streamMultiAgentResponse(
  apiKey: string,
  context: AgentContext,
  userMessage: string
): AsyncGenerator<AgentEvent> {
  const events: AgentEvent[] = [];
  let resolveNext: ((event: AgentEvent) => void) | null = null;

  const orchestrator = new MultiAgentOrchestrator(apiKey, context, (event) => {
    if (resolveNext) {
      resolveNext(event);
      resolveNext = null;
    } else {
      events.push(event);
    }
  });

  // Start processing in background
  const resultPromise = orchestrator.processRequest(userMessage);

  // Yield events as they come
  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else {
      // Wait for next event or completion
      const event = await Promise.race([
        new Promise<AgentEvent>((resolve) => {
          resolveNext = resolve;
        }),
        resultPromise.then(() => null as AgentEvent | null),
      ]);

      if (event === null) {
        // Processing complete, yield remaining events
        while (events.length > 0) {
          yield events.shift()!;
        }
        break;
      }

      yield event;
    }
  }

  // Return final result
  const result = await resultPromise;
  yield {
    type: 'agent_completed',
    message: result.response,
    data: { files: result.files, plan: result.plan },
    timestamp: new Date(),
  };
}
