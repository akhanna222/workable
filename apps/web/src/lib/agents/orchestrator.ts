import Anthropic from '@anthropic-ai/sdk';
import { AGENT_CONFIGS, getAgentConfig } from './agent-configs';
import {
  AgentContext,
  AgentEvent,
  AgentResponse,
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

  constructor(
    apiKey: string,
    context: AgentContext,
    onEvent?: (event: AgentEvent) => void
  ) {
    this.anthropic = new Anthropic({ apiKey });
    this.context = context;
    this.eventCallback = onEvent;
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

    const plan = await this.createPlan(userMessage);

    this.emit({
      type: 'agent_completed',
      agentRole: 'orchestrator',
      message: `Created plan with ${plan.tasks.length} tasks`,
      data: plan,
    });

    // Step 2: Execute tasks in order
    const allFiles: GeneratedFile[] = [];
    const completedTasks: AgentTask[] = [];

    for (const task of plan.tasks) {
      // Check if dependencies are met
      const dependenciesMet = task.dependencies?.every((depOrder) =>
        completedTasks.some((ct) => ct.id === `task-${depOrder}`)
      ) ?? true;

      if (!dependenciesMet) {
        continue; // Skip if dependencies not met (shouldn't happen with proper ordering)
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
      const result = await this.executeTask(task, allFiles);

      if (result.success && result.files) {
        allFiles.push(...result.files);

        for (const file of result.files) {
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
    const response = this.generateSummary(plan, allFiles, completedTasks);

    return { plan, files: allFiles, response };
  }

  private async createPlan(userMessage: string): Promise<OrchestratorPlan> {
    const config = getAgentConfig('orchestrator');

    const existingFilesContext =
      this.context.existingFiles.length > 0
        ? `\n\nExisting project files:\n${this.context.existingFiles.map((f) => `- ${f.path}`).join('\n')}`
        : '\n\nThis is a new project with no existing files.';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: config.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `User request: ${userMessage}${existingFilesContext}\n\nCreate a detailed implementation plan as JSON.`,
        },
      ],
    });

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const planData = JSON.parse(jsonMatch[1]);
        return {
          summary: planData.summary || planData.understanding,
          tasks: planData.tasks.map((t: any, i: number) => ({
            order: t.order || i + 1,
            agent: t.agent as AgentRole,
            description: t.description,
            files: t.files || [],
            dependencies: t.dependencies || [],
          })),
          estimatedFiles: planData.tasks.reduce(
            (sum: number, t: any) => sum + (t.files?.length || 1),
            0
          ),
        };
      } catch (e) {
        console.error('Failed to parse orchestrator plan:', e);
      }
    }

    // Fallback: simple single-task plan
    return {
      summary: 'Building the requested feature',
      tasks: [
        {
          order: 1,
          agent: 'ui',
          description: userMessage,
          files: ['src/App.tsx'],
        },
      ],
      estimatedFiles: 1,
    };
  }

  private async executeTask(
    task: OrchestratorPlan['tasks'][0],
    existingFiles: GeneratedFile[]
  ): Promise<TaskResult> {
    const config = getAgentConfig(task.agent);

    // Build context from existing files
    const relevantFiles = existingFiles.filter((f) =>
      config.filePatterns.some((pattern) => {
        const regex = new RegExp(
          pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
        );
        return regex.test(f.path);
      })
    );

    const filesContext =
      relevantFiles.length > 0
        ? `\n\nExisting related files:\n${relevantFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}`
        : '';

    const allFilesContext =
      existingFiles.length > 0
        ? `\n\nAll project files:\n${existingFiles.map((f) => `- ${f.path}`).join('\n')}`
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
            content: `Task: ${task.description}\n\nExpected files to create/modify: ${task.files.join(', ')}${filesContext}${allFilesContext}\n\nGenerate the complete file contents. Use <file path="...">content</file> format for each file.`,
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

      return {
        success: files.length > 0,
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
    const fileRegex = /<file path="([^"]+)">\n?([\s\S]*?)\n?<\/file>/g;

    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      const [, path, fileContent] = match;
      files.push({
        path,
        content: fileContent.trim(),
        language: this.getLanguageFromPath(path),
        action: this.context.existingFiles.some((f) => f.path === path)
          ? 'modify'
          : 'create',
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
      html: 'html',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
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

    return `## Summary

${plan.summary}

### Completed Tasks
${tasks.map((t) => `- [${t.status === 'completed' ? '✓' : '✗'}] ${t.description}`).join('\n')}

### Generated Files (${files.length})
${fileList}

${successCount === tasks.length ? 'All tasks completed successfully!' : `${successCount}/${tasks.length} tasks completed.`}`;
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
