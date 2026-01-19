// Template prompts and starter files for different project types

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: { path: string; content: string }[];
  prompt?: string;
}

export const TEMPLATES: Record<string, ProjectTemplate> = {
  blank: {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with an empty canvas',
    icon: '📝',
    files: [
      {
        path: 'src/App.tsx',
        content: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          Welcome to your new app
        </h1>
        <p className="mt-4 text-gray-600">
          Start building something amazing
        </p>
      </div>
    </div>
  );
}`,
      },
      {
        path: 'src/index.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      },
    ],
  },

  landing: {
    id: 'landing',
    name: 'Landing Page',
    description: 'Marketing page with hero, features, and CTA',
    icon: '🚀',
    prompt: 'Create a modern landing page with a hero section, features grid, testimonials, and a call-to-action footer. Use a clean, professional design.',
    files: [],
  },

  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin dashboard with charts and tables',
    icon: '📊',
    prompt: 'Create an admin dashboard with a sidebar navigation, header with user menu, and a main content area showing stats cards, a line chart, and a data table.',
    files: [],
  },

  saas: {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Full SaaS app with auth, billing, and dashboard',
    icon: '💼',
    prompt: 'Create a SaaS application starter with authentication pages (login, signup, forgot password), a dashboard, settings page, and a landing page.',
    files: [],
  },
};

export function getTemplateFiles(templateId: string): { path: string; content: string }[] {
  return TEMPLATES[templateId]?.files || TEMPLATES.blank.files;
}

export function getTemplatePrompt(templateId: string): string | undefined {
  return TEMPLATES[templateId]?.prompt;
}
