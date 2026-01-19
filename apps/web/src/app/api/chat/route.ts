import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MultiAgentOrchestrator } from '@/lib/agents/orchestrator';
import { AgentContext, AgentEvent, GeneratedFile } from '@/lib/agents/types';
import { getLanguageFromPath } from '@/lib/utils';

export const maxDuration = 60; // Allow up to 60 seconds for complex generations

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, conversationId, message, history } = await request.json();

    // Verify user has access to project
    const { data: project } = await supabase
      .from('projects')
      .select('*, workspace:workspaces(*)')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get existing files for context
    const { data: existingFiles } = await supabase
      .from('files')
      .select('path, content, language')
      .eq('project_id', projectId);

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start multi-agent processing in background
    (async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        // Demo mode - generate a simple response
        await handleDemoMode(writer, encoder, message, projectId, conversationId, supabase, project.workspace_id);
        return;
      }

      try {
        // Build agent context
        const context: AgentContext = {
          projectId,
          conversationId: conversationId || '',
          existingFiles: (existingFiles || []).map((f) => ({
            path: f.path,
            content: f.content || '',
            language: f.language || 'plaintext',
            action: 'modify' as const,
          })),
          techStack: {
            frontend: 'react',
            styling: 'tailwind',
            backend: 'nextjs-api',
            database: 'supabase',
            auth: 'supabase-auth',
          },
          tasks: [],
          messages: history || [],
        };

        const allFiles: GeneratedFile[] = [];
        let fullContent = '';

        // Create orchestrator with event streaming
        const orchestrator = new MultiAgentOrchestrator(
          apiKey,
          context,
          async (event: AgentEvent) => {
            // Send event to client
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'event',
                  event: {
                    type: event.type,
                    agentRole: event.agentRole,
                    message: event.message,
                    timestamp: event.timestamp.toISOString(),
                  },
                })}\n\n`
              )
            );

            // Track text content
            if (event.type === 'agent_completed' && event.message) {
              fullContent += event.message + '\n';
            }

            // Send file updates
            if (event.type === 'file_created' || event.type === 'file_modified') {
              const file = event.data as GeneratedFile;
              if (file && !allFiles.some((f) => f.path === file.path)) {
                allFiles.push(file);
                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'files',
                      files: allFiles,
                    })}\n\n`
                  )
                );
              }
            }
          }
        );

        // Process the request
        const result = await orchestrator.processRequest(message);

        // Send final response
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'text',
              content: result.response,
            })}\n\n`
          )
        );

        // Send all files
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'files',
              files: result.files,
            })}\n\n`
          )
        );

        // Save to database
        await saveToDatabase(
          supabase,
          projectId,
          conversationId,
          message,
          result.response,
          result.files,
          project.workspace_id
        );

        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error: any) {
        console.error('Multi-agent error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              message: error.message,
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function saveToDatabase(
  supabase: any,
  projectId: string,
  conversationId: string | null,
  userMessage: string,
  assistantMessage: string,
  files: GeneratedFile[],
  workspaceId: string
) {
  // Save messages
  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
    });

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage,
      files_changed: files.map((f) => f.path),
    });
  }

  // Save files
  for (const file of files) {
    await supabase.from('files').upsert(
      {
        project_id: projectId,
        path: file.path,
        content: file.content,
        language: file.language,
      },
      {
        onConflict: 'project_id,path',
      }
    );
  }

  // Track usage
  await supabase.from('usage').insert({
    workspace_id: workspaceId,
    type: 'ai_tokens',
    amount: assistantMessage.length + files.reduce((sum, f) => sum + f.content.length, 0),
    project_id: projectId,
  });
}

// Demo mode for when API key is not configured
async function handleDemoMode(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  message: string,
  projectId: string,
  conversationId: string | null,
  supabase: any,
  workspaceId: string
) {
  // Simulate multi-agent events
  const events = [
    { type: 'agent_started', agentRole: 'orchestrator', message: '🎯 Project Architect analyzing your request...' },
    { type: 'agent_thinking', agentRole: 'orchestrator', message: 'Breaking down the project into tasks...' },
    { type: 'agent_completed', agentRole: 'orchestrator', message: '✓ Created implementation plan with 2 tasks' },
    { type: 'task_started', agentRole: 'ui', message: 'Task 1: Building UI components' },
    { type: 'agent_started', agentRole: 'ui', message: '🎨 UI Engineer started working...' },
    { type: 'agent_thinking', agentRole: 'ui', message: 'Designing component structure...' },
    { type: 'agent_writing', agentRole: 'ui', message: 'Writing React components with Tailwind CSS...' },
  ];

  for (const event of events) {
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: 'event',
          event: { ...event, timestamp: new Date().toISOString() },
        })}\n\n`
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  // Generate demo response
  const demoResponse = generateDemoResponse(message);

  // Send file creation events
  for (const file of demoResponse.files) {
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: 'event',
          event: {
            type: 'file_created',
            agentRole: 'ui',
            message: `Created: ${file.path}`,
            timestamp: new Date().toISOString(),
          },
        })}\n\n`
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Send files
  await writer.write(
    encoder.encode(
      `data: ${JSON.stringify({
        type: 'files',
        files: demoResponse.files,
      })}\n\n`
    )
  );

  // Complete events
  const completeEvents = [
    { type: 'task_completed', agentRole: 'ui', message: '✓ Task 1 completed' },
    { type: 'agent_completed', agentRole: 'ui', message: '🎨 UI Engineer finished' },
  ];

  for (const event of completeEvents) {
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: 'event',
          event: { ...event, timestamp: new Date().toISOString() },
        })}\n\n`
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Send final text
  await writer.write(
    encoder.encode(
      `data: ${JSON.stringify({
        type: 'text',
        content: demoResponse.summary,
      })}\n\n`
    )
  );

  // Save to database
  await saveToDatabase(
    supabase,
    projectId,
    conversationId,
    message,
    demoResponse.summary,
    demoResponse.files,
    workspaceId
  );

  await writer.write(encoder.encode('data: [DONE]\n\n'));
  await writer.close();
}

function generateDemoResponse(message: string): {
  summary: string;
  files: GeneratedFile[];
} {
  const lowerMessage = message.toLowerCase();

  let appContent = '';
  let cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
  let summary = '';

  if (lowerMessage.includes('todo') || lowerMessage.includes('task')) {
    appContent = `import { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category: string;
}

const categories = ['Work', 'Personal', 'Shopping', 'Health'];

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('Work');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: input,
        completed: false,
        category
      }]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Task Manager</h1>
          <p className="text-white/70">Organize your day efficiently</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'bg-white/20' },
            { label: 'Active', value: stats.active, color: 'bg-blue-500/30' },
            { label: 'Done', value: stats.completed, color: 'bg-green-500/30' },
          ].map(stat => (
            <div key={stat.label} className={\`\${stat.color} backdrop-blur-sm rounded-xl p-4 text-center\`}>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-white/70 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              onClick={addTodo}
              className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>

          <div className="flex gap-2">
            {(['all', 'active', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${
                  filter === f
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }\`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
              <p className="text-white/70">
                {filter === 'all' ? 'No tasks yet. Add one above!' : \`No \${filter} tasks.\`}
              </p>
            </div>
          ) : (
            filteredTodos.map(todo => (
              <div
                key={todo.id}
                className={\`bg-white rounded-xl p-4 shadow-lg flex items-center gap-4 transition-all \${
                  todo.completed ? 'opacity-70' : ''
                }\`}
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={\`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors \${
                    todo.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-purple-500'
                  }\`}
                >
                  {todo.completed && '✓'}
                </button>
                <div className="flex-1">
                  <p className={\`font-medium \${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}\`}>
                    {todo.text}
                  </p>
                  <span className="text-xs text-purple-500 font-medium">{todo.category}</span>
                </div>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;`;
    summary = `## Summary

**Project Architect** analyzed your request and coordinated the team.

### Agents Involved
- 🎯 **Orchestrator**: Planned the implementation
- 🎨 **UI Engineer**: Built React components with Tailwind CSS

### Completed Tasks
- [✓] Created main App component with state management
- [✓] Built task input with category selection
- [✓] Implemented task filtering (all/active/completed)
- [✓] Added task statistics dashboard
- [✓] Styled with gradient background and modern UI

### Generated Files (2)
- \`src/App.tsx\` - Main application component
- \`src/index.css\` - Tailwind CSS styles

The app includes categories, completion tracking, filtering, and a beautiful purple gradient design!`;
  } else if (lowerMessage.includes('dashboard') || lowerMessage.includes('chart') || lowerMessage.includes('analytics')) {
    appContent = `import { useState } from 'react';

const salesData = [
  { month: 'Jan', sales: 4000 },
  { month: 'Feb', sales: 3000 },
  { month: 'Mar', sales: 5000 },
  { month: 'Apr', sales: 4500 },
  { month: 'May', sales: 6000 },
  { month: 'Jun', sales: 5500 },
];

const recentOrders = [
  { id: '#3210', customer: 'John Doe', status: 'Delivered', amount: '$125.00' },
  { id: '#3209', customer: 'Jane Smith', status: 'Processing', amount: '$89.00' },
  { id: '#3208', customer: 'Bob Wilson', status: 'Shipped', amount: '$254.00' },
  { id: '#3207', customer: 'Alice Brown', status: 'Pending', amount: '$176.00' },
];

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const stats = [
    { label: 'Total Revenue', value: '$45,231', change: '+20.1%', positive: true },
    { label: 'Orders', value: '1,754', change: '+12.5%', positive: true },
    { label: 'Customers', value: '892', change: '+8.2%', positive: true },
    { label: 'Avg. Order', value: '$125', change: '-2.4%', positive: false },
  ];

  const maxSales = Math.max(...salesData.map(d => d.sales));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={\`\${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white p-4 transition-all duration-300\`}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0" />
          {sidebarOpen && <span className="text-xl font-bold">Analytics</span>}
        </div>
        <nav className="space-y-1">
          {['Dashboard', 'Orders', 'Products', 'Customers', 'Settings'].map((item, i) => (
            <button
              key={item}
              className={\`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors \${
                i === 0 ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }\`}
            >
              <span className="text-lg">{['📊', '📦', '🏷️', '👥', '⚙️'][i]}</span>
              {sidebarOpen && <span>{item}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Welcome back! Here's what's happening.</p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-200 rounded-lg"
          >
            ☰
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-500 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <span className={\`text-sm font-medium \${stat.positive ? 'text-green-500' : 'text-red-500'}\`}>
                {stat.change}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-6">Sales Overview</h3>
            <div className="flex items-end gap-4 h-64">
              {salesData.map(item => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-sm font-medium text-gray-600">\${(item.sales/1000).toFixed(0)}k</div>
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-700 hover:to-blue-500 cursor-pointer"
                    style={{ height: \`\${(item.sales / maxSales) * 100}%\` }}
                  />
                  <span className="text-sm text-gray-500">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-6">Traffic Sources</h3>
            <div className="space-y-4">
              {[
                { label: 'Direct', value: 50, color: 'bg-blue-500' },
                { label: 'Social', value: 30, color: 'bg-purple-500' },
                { label: 'Organic', value: 20, color: 'bg-green-500' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={\`h-full \${item.color} rounded-full\`} style={{ width: \`\${item.value}%\` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.customer}</td>
                    <td className="px-6 py-4">
                      <span className={\`px-2 py-1 text-xs font-medium rounded-full \${
                        order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'Shipped' ? 'bg-purple-100 text-purple-700' :
                        'bg-yellow-100 text-yellow-700'
                      }\`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;`;
    summary = `## Summary

**Project Architect** coordinated the team to build your analytics dashboard.

### Agents Involved
- 🎯 **Orchestrator**: Designed the dashboard layout
- 🎨 **UI Engineer**: Built responsive components

### Completed Tasks
- [✓] Created collapsible sidebar navigation
- [✓] Built stats cards with trend indicators
- [✓] Implemented bar chart for sales visualization
- [✓] Added progress bars for traffic sources
- [✓] Created orders table with status badges

### Generated Files (2)
- \`src/App.tsx\` - Dashboard component
- \`src/index.css\` - Tailwind CSS styles

The dashboard features a dark sidebar, stats overview, charts, and a data table!`;
  } else {
    appContent = `import { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg" />
              <span className="text-xl font-bold">MyApp</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {['home', 'features', 'pricing', 'about'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={\`capitalize transition-colors \${
                    activeTab === tab ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
                  }\`}
                >
                  {tab}
                </button>
              ))}
              <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Now in Beta
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            Build Amazing
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"> Digital Experiences</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Create stunning applications with our powerful platform.
            No coding required—just describe what you want.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-semibold transition-all transform hover:scale-105">
              Start Building Free
            </button>
            <button className="w-full sm:w-auto px-8 py-4 border border-gray-700 hover:border-gray-600 rounded-xl font-semibold transition-colors">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Powerful Features</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Everything you need to build and scale
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '⚡', title: 'Lightning Fast', desc: 'Optimized for speed' },
              { icon: '🔒', title: 'Secure', desc: 'Enterprise-grade security' },
              { icon: '🎨', title: 'Beautiful', desc: 'Stunning UI components' },
              { icon: '📱', title: 'Responsive', desc: 'Works on any device' },
              { icon: '🔌', title: 'Integrations', desc: 'Connect your tools' },
              { icon: '📊', title: 'Analytics', desc: 'Built-in insights' },
            ].map((feature, i) => (
              <div key={i} className="p-6 bg-gray-900 rounded-2xl border border-gray-800 hover:border-cyan-500/50 transition-colors">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8">Join thousands building with our platform.</p>
          <button className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold">
            Create Free Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded" />
            <span className="text-gray-400">MyApp</span>
          </div>
          <p className="text-gray-500 text-sm">© 2024 MyApp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;`;
    summary = `## Summary

**Project Architect** coordinated the team to build your landing page.

### Agents Involved
- 🎯 **Orchestrator**: Planned the page structure
- 🎨 **UI Engineer**: Built responsive components

### Completed Tasks
- [✓] Created responsive navigation with mobile support
- [✓] Built hero section with gradient text and CTAs
- [✓] Implemented features grid with hover effects
- [✓] Added CTA section and footer

### Generated Files (2)
- \`src/App.tsx\` - Landing page component
- \`src/index.css\` - Tailwind CSS styles

The landing page features a dark theme with cyan accents and smooth animations!`;
  }

  return {
    summary,
    files: [
      {
        path: 'src/App.tsx',
        content: appContent,
        language: 'typescript',
        action: 'create' as const,
      },
      {
        path: 'src/index.css',
        content: cssContent,
        language: 'css',
        action: 'create' as const,
      },
    ],
  };
}
