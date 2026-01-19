#!/bin/bash
# Quick Start Script for BuilderAI
# This script helps you get the application running quickly

set -e

echo "=========================================="
echo "BuilderAI Quick Start"
echo "=========================================="

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Please install Node.js 18+ and try again."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Please install Node.js and try again."; exit 1; }

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo ""
echo "Step 1: Checking environment configuration..."
if [ ! -f "apps/web/.env.local" ]; then
    echo "No .env.local found. Creating from template..."
    cp apps/web/.env.example apps/web/.env.local
    echo ""
    echo "⚠️  Please edit apps/web/.env.local and add your API keys:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "Step 2: Installing dependencies..."
npm install

echo ""
echo "Step 3: Building application..."
npm run build

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To start the production server:"
echo "  npm run start --prefix apps/web"
echo ""
echo "The application will be available at:"
echo "  http://localhost:3000"
echo ""
