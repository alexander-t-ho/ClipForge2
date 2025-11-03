#!/bin/bash

# ClipForge2 Build Script
echo "🎬 Building ClipForge2 Desktop Video Editor..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/

# Build React app
echo "⚛️  Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ React build failed!"
    exit 1
fi

# Build Electron app
echo "⚡ Building Electron application..."
npm run dist

if [ $? -ne 0 ]; then
    echo "❌ Electron build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"
echo ""
echo "📦 Distribution files created:"
echo "   - DMG: dist/ClipForge2-1.0.0.dmg"
echo "   - App Bundle: dist/mac/ClipForge2.app"
echo ""
echo "🚀 You can now distribute the DMG file or run the app directly!"

# Optional: Open the dist folder
if command -v open &> /dev/null; then
    echo "📁 Opening distribution folder..."
    open dist/
fi
