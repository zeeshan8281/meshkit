#!/bin/bash
set -e

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

echo "🧪 Testing meshkit locally..."
echo ""

# Build all packages
echo "📦 Building packages..."
pnpm build

# Create test directory
TEST_DIR="$ROOT_DIR/.test-app"
rm -rf "$TEST_DIR"

echo ""
echo "🕸️  Running create-mesh-app..."
echo ""

# Run the CLI directly with tsx
cd packages/cli
pnpm tsx src/create.ts test-app --no-install 2>/dev/null || npx tsx src/create.ts test-app

# Move the created app
mv "$ROOT_DIR/packages/cli/test-app" "$TEST_DIR"

# Update package.json to use local packages
cd "$TEST_DIR"
cat > package.json << 'EOF'
{
  "name": "test-app",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "meshkit": "file:../packages/meshkit",
    "@meshkit/mcp": "file:../packages/mcp"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
EOF

echo ""
echo "📥 Installing dependencies..."
pnpm install

echo ""
echo "✅ Test app created at: $TEST_DIR"
echo ""
echo "Next steps:"
echo "  cd .test-app"
echo "  cp .env.example .env"
echo "  # Add your ANTHROPIC_API_KEY to .env"
echo "  pnpm dev"
echo ""
