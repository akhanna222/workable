import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getLanguageFromPath } from '@/lib/utils';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert full-stack developer AI assistant specialized in building React applications with TypeScript and Tailwind CSS.

## Your Role
You help users build web applications by generating high-quality, production-ready code. When users describe what they want, you:
1. Understand their requirements
2. Plan the implementation
3. Generate complete, working code
4. Explain what you built

## Tech Stack
- React 18 with functional components and hooks
- TypeScript for type safety
- Tailwind CSS for styling
- Modern ES6+ JavaScript

## Code Generation Rules
1. Always generate complete files, not partial code
2. Use TypeScript with proper types (but keep them simple for the preview)
3. Follow React best practices (hooks, composition)
4. Make components responsive by default using Tailwind
5. Use semantic HTML elements
6. Include proper error handling
7. Keep code clean and readable

## File Structure
Use this standard structure:
\`\`\`
src/
  components/     # Reusable UI components
  App.tsx         # Main app component
  index.css       # Global styles
\`\`\`

## Response Format
When generating code, use this EXACT format:

<thinking>
Brief analysis of the request and implementation plan
</thinking>

<file path="src/App.tsx">
// Complete file content here
</file>

<file path="src/index.css">
/* CSS content here */
</file>

<summary>
Brief explanation of what was created and how to use it
</summary>

## Important Rules
- Generate ALL necessary files for the feature to work
- Always include an App.tsx file that renders the main component
- Include CSS in src/index.css with Tailwind directives (@tailwind base; etc)
- Make the UI visually polished with Tailwind classes
- Consider edge cases and error states
- Use useState for state management
- Use simple, self-contained components (no external dependencies beyond React)
- Make sure the code can run in a browser with React loaded via CDN`;

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
      .select('path, content')
      .eq('project_id', projectId);

    // Build context with existing files
    let filesContext = '';
    if (existingFiles && existingFiles.length > 0) {
      filesContext = '\n\n## Current Project Files\n';
      existingFiles.forEach((file) => {
        filesContext += `\n### ${file.path}\n\`\`\`\n${file.content || '// Empty file'}\n\`\`\`\n`;
      });
    }

    // Build message history
    const messages = [
      ...(history || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: message + filesContext,
      },
    ];

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start Claude streaming in background
    (async () => {
      let fullContent = '';
      const generatedFiles: { path: string; content: string }[] = [];

      try {
        // Check if API key is configured
        if (!process.env.ANTHROPIC_API_KEY) {
          // Demo mode - generate a simple response without API
          const demoResponse = generateDemoResponse(message);

          // Stream the demo response
          for (const char of demoResponse.content) {
            fullContent += char;
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`)
            );
            // Small delay for streaming effect
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          // Send files
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: 'files', files: demoResponse.files })}\n\n`)
          );
          generatedFiles.push(...demoResponse.files);
        } else {
          // Real API call
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages,
            stream: true,
          });

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const text = event.delta.text;
              fullContent += text;

              // Send text chunk
              await writer.write(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
              );

              // Extract files as they complete
              const fileMatches = fullContent.matchAll(
                /<file path="([^"]+)">\n?([\s\S]*?)\n?<\/file>/g
              );

              for (const match of fileMatches) {
                const [, path, content] = match;
                const existingFile = generatedFiles.find((f) => f.path === path);

                if (!existingFile) {
                  generatedFiles.push({ path, content: content.trim() });

                  // Send file update
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'files',
                        files: generatedFiles,
                      })}\n\n`
                    )
                  );
                }
              }
            }
          }
        }

        // Save message to database
        if (conversationId) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: message,
          });

          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullContent,
            files_changed: generatedFiles.map((f) => f.path),
          });
        }

        // Save generated files to database
        for (const file of generatedFiles) {
          await supabase.from('files').upsert(
            {
              project_id: projectId,
              path: file.path,
              content: file.content,
              language: getLanguageFromPath(file.path),
            },
            {
              onConflict: 'project_id,path',
            }
          );
        }

        // Track usage
        await supabase.from('usage').insert({
          workspace_id: project.workspace_id,
          type: 'ai_tokens',
          amount: fullContent.length,
          project_id: projectId,
        });

        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error: any) {
        console.error('Chat API error:', error);
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

// Demo response generator for when API key is not configured
function generateDemoResponse(message: string): { content: string; files: { path: string; content: string }[] } {
  const lowerMessage = message.toLowerCase();

  // Generate appropriate response based on message
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
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 py-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Todo App
        </h1>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={addTodo}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {todos.map(todo => (
            <li
              key={todo.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="w-5 h-5 text-purple-500"
              />
              <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}\`}>
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {todos.length === 0 && (
          <p className="text-center text-gray-400 py-8">No tasks yet. Add one above!</p>
        )}
      </div>
    </div>
  );
}

export default App;`;
    summary = 'I created a beautiful Todo app with the ability to add, complete, and delete tasks. The app features a gradient background and clean card-based design.';
  } else if (lowerMessage.includes('counter')) {
    appContent = `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Counter</h1>
        <div className="text-6xl font-bold text-blue-500 mb-6">{count}</div>
        <div className="flex gap-4">
          <button
            onClick={() => setCount(count - 1)}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xl font-semibold"
          >
            -
          </button>
          <button
            onClick={() => setCount(0)}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setCount(count + 1)}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xl font-semibold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;`;
    summary = 'I created a simple counter app with increment, decrement, and reset buttons. The design features a beautiful gradient background with a clean card interface.';
  } else if (lowerMessage.includes('landing') || lowerMessage.includes('page')) {
    appContent = `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Build Something Amazing
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            The fastest way to create beautiful, responsive web applications with modern tools and best practices.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors">
              Get Started
            </button>
            <button className="px-8 py-3 border border-gray-600 hover:border-gray-500 rounded-lg font-semibold transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {['Fast', 'Secure', 'Scalable'].map((feature, i) => (
              <div key={i} className="p-6 bg-gray-900 rounded-xl">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">{'⚡🔒📈'[i]}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature}</h3>
                <p className="text-gray-400">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500">
          © 2024 Your Company. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;`;
    summary = 'I created a modern landing page with a hero section, features grid, and footer. The design uses a dark theme with gradient accents.';
  } else {
    // Default welcome app
    appContent = `import { useState } from 'react';

function App() {
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('');

  const handleGreet = () => {
    if (name.trim()) {
      setGreeting(\`Hello, \${name}! Welcome to your app.\`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">
          Welcome! 👋
        </h1>

        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleGreet()}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <button
            onClick={handleGreet}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Say Hello
          </button>

          {greeting && (
            <div className="p-4 bg-purple-50 rounded-lg text-purple-700 text-center animate-fade-in">
              {greeting}
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Built with React & Tailwind CSS
        </p>
      </div>
    </div>
  );
}

export default App;`;
    cssContent += `

.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}`;
    summary = 'I created a simple welcome app where users can enter their name and receive a personalized greeting. The design features a beautiful gradient background with a clean card interface.';
  }

  const content = `<thinking>
Let me analyze the request and create a clean, modern implementation.
</thinking>

<file path="src/App.tsx">
${appContent}
</file>

<file path="src/index.css">
${cssContent}
</file>

<summary>
${summary}
</summary>`;

  return {
    content,
    files: [
      { path: 'src/App.tsx', content: appContent },
      { path: 'src/index.css', content: cssContent },
    ],
  };
}
