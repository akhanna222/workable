import Link from 'next/link';
import { ArrowRight, Sparkles, Code, Zap, Globe } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
              <span className="text-xl font-bold text-white">BuilderAI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Powered by Claude AI</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Build apps with
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {' '}AI superpowers
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Describe what you want to build in plain English. Our AI generates production-ready code with database, authentication, and deployment—all in minutes.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Start Building Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#demo"
              className="px-6 py-3 border border-gray-700 hover:border-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Everything you need to build faster
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Code}
              title="AI Code Generation"
              description="Describe your app in natural language and watch as AI generates clean, maintainable React code with TypeScript."
            />
            <FeatureCard
              icon={Zap}
              title="Instant Preview"
              description="See your changes in real-time with hot reloading. Edit code and preview updates instantly."
            />
            <FeatureCard
              icon={Globe}
              title="One-Click Deploy"
              description="Deploy your app to production with a single click. Custom domains and SSL included."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to build something amazing?
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of developers building with AI.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
              <span className="text-sm text-gray-400">BuilderAI</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 BuilderAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
