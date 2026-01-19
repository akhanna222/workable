import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BuilderAI - AI-Powered App Builder',
  description: 'Build production-ready applications with AI. Describe what you want to build and watch it come to life.',
  keywords: ['AI', 'app builder', 'code generation', 'React', 'TypeScript'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
