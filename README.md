# Lovable Clone - AI-Powered App Builder

An AI-powered full-stack application builder that allows users to describe applications in natural language and generates production-ready code with database, authentication, and deployment—all from a single interface.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS
- **Editor**: Monaco Editor
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: Claude API (Anthropic)
- **State**: Zustand
- **Styling**: Tailwind CSS

## Project Structure

```
lovable-clone/
├── apps/
│   └── web/                    # Main Next.js application
│       ├── src/
│       │   ├── app/            # App router pages
│       │   ├── components/     # React components
│       │   ├── lib/            # Utilities
│       │   ├── hooks/          # Custom hooks
│       │   ├── stores/         # Zustand stores
│       │   └── types/          # TypeScript types
│       └── public/
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── shared/                 # Shared utilities & types
│   └── database/               # Database schema & migrations
├── package.json                # Root package.json
├── turbo.json                  # Turborepo config
└── tsconfig.json               # Root TypeScript config
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key (optional for AI features)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lovable-clone
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   Fill in your Supabase and Anthropic API credentials.

4. Set up the database:
   - Go to your Supabase project
   - Run the SQL from `packages/database/schema.sql` in the SQL editor

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **AI Code Generation**: Describe what you want to build and get production-ready React code
- **Live Preview**: See your changes in real-time with hot reloading
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Authentication**: Email/password and OAuth (Google, GitHub) authentication
- **Project Management**: Create, organize, and manage multiple projects
- **Responsive Design**: Works on desktop and mobile devices

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., http://localhost:3000) |

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## License

MIT
