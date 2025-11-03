@echo off
REM ClipForge2 Build Script for Windows

echo 🎬 Building ClipForge2 Desktop Video Editor...

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

REM Build React app
echo ⚛️  Building React application...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ React build failed!
    exit /b 1
)

REM Build Electron app
echo ⚡ Building Electron application...
call npm run dist
if %errorlevel% neq 0 (
    echo ❌ Electron build failed!
    exit /b 1
)

echo ✅ Build completed successfully!
echo.
echo 📦 Distribution files created:
echo    - NSIS Installer: dist\ClipForge2-1.0.0.exe
echo    - Portable: dist\win-unpacked\ClipForge2.exe
echo.
echo 🚀 You can now distribute the installer or run the app directly!

REM Open the dist folder
echo 📁 Opening distribution folder...
start dist
