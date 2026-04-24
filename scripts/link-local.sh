#!/bin/bash
set -e

echo "🔗 Linking meshkit packages locally..."

cd "$(dirname "$0")/.."

# Build all packages first
echo "📦 Building packages..."
pnpm build

# Link each package globally
echo "🔗 Linking packages..."
cd packages/meshkit && pnpm link --global
cd ../mcp && pnpm link --global
cd ../providers && pnpm link --global
cd ../cli && pnpm link --global
cd ../trace-ui && pnpm link --global

echo ""
echo "✅ Done! Packages linked globally:"
echo "   - meshkit"
echo "   - @meshkit/mcp"
echo "   - @meshkit/providers"
echo "   - @meshkit/cli"
echo "   - @meshkit/trace-ui"
echo ""
echo "Now you can run:"
echo "   meshkit create my-app --local"
echo ""
