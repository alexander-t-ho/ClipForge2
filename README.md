# ClipForge2 - Desktop Video Editor

A desktop video editor built with Electron and React in 72 hours. This application provides basic video editing capabilities including import, timeline editing, trimming, and export functionality.

## Features

### MVP Features (Completed)
- ✅ Desktop app that launches (Electron + React)
- ✅ Basic video import (drag & drop + file picker)
- ✅ Simple timeline view showing imported clips
- ✅ Video preview player
- ✅ Basic trim functionality
- ✅ Export to MP4
- ✅ Built and packaged as native app

### Core Features
- 🎬 Video file import (MP4, MOV, WebM, AVI)
- 📱 Drag & drop interface
- ⏱️ Timeline with draggable clips
- ✂️ Basic trimming functionality
- 🎥 Video preview with playback controls
- 💾 MP4 export with progress indicator
- 🖥️ Screen recording (planned)
- 📹 Webcam recording (planned)

## Prerequisites

- Node.js (v18 or higher)
- FFmpeg installed on your system
- npm or yarn package manager

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html or use chocolatey:
```bash
choco install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ClipForge2
```

2. Install dependencies:
```bash
npm install
```

## Development

### Running in Development Mode

1. Start the webpack dev server:
```bash
npm start
```

2. In another terminal, start Electron:
```bash
npm run electron-dev
```

This will open the Electron app with hot reloading enabled.

### Building for Production

1. Build the React app:
```bash
npm run build
```

2. Package the Electron app:
```bash
npm run dist
```

The packaged app will be available in the `dist` folder.

## Usage

### Importing Videos
1. Click "Import Video" button or drag & drop video files onto the app
2. Supported formats: MP4, MOV, WebM, AVI, MKV
3. Videos will appear in the sidebar media library

### Timeline Editing
1. Clips appear on the timeline automatically
2. Drag clips to reposition them
3. Click on clips to select them
4. Use the playhead to scrub through the timeline

### Trimming Clips
1. Select a clip on the timeline
2. Drag the edges of the clip to trim start/end points
3. Preview changes in the video player

### Exporting Videos
1. Click "Export MP4" button
2. Choose output location and filename
3. Monitor export progress in the header
4. Exported video will be saved to your chosen location

## Project Structure

```
ClipForge2/
├── public/
│   ├── electron.js          # Main Electron process
│   ├── preload.js          # Preload script for IPC
│   └── index.html          # HTML template
├── src/
│   ├── components/         # React components
│   │   ├── Header.js      # App header with controls
│   │   ├── Sidebar.js     # Media library sidebar
│   │   ├── Timeline.js    # Timeline editor
│   │   ├── Preview.js     # Video preview player
│   │   └── VideoImporter.js # File import dialog
│   ├── App.js             # Main React component
│   ├── App.css            # Application styles
│   └── index.js           # React entry point
├── package.json           # Dependencies and scripts
└── webpack.config.js      # Webpack configuration
```

## Technical Stack

- **Desktop Framework:** Electron
- **Frontend:** React 18
- **Build Tool:** Webpack 5
- **Video Processing:** FFmpeg (via fluent-ffmpeg)
- **Styling:** CSS3 with modern features
- **Package Manager:** npm

## Development Timeline

This project was built in 72 hours with the following phases:

### Day 1: Foundation & Import
- Project setup and basic UI
- Video file import functionality
- Basic timeline and preview

### Day 2: Editing Features
- Timeline interactions and clip manipulation
- Trimming functionality
- Export system with FFmpeg integration

### Day 3: Polish & Packaging
- Screen recording capabilities
- Advanced features and bug fixes
- App packaging and distribution

## Known Issues

- Export currently only handles single clips (multi-clip export planned)
- Screen recording not yet implemented
- Limited transition effects
- No audio controls

## Contributing

This is a 72-hour challenge project. For production use, consider:
- Adding comprehensive error handling
- Implementing undo/redo functionality
- Adding more video effects and transitions
- Improving performance with large files
- Adding keyboard shortcuts

## License

MIT License - feel free to use this code for your own projects!

## Acknowledgments

Built as part of a 72-hour coding challenge to create a desktop video editor from scratch. Inspired by CapCut's intuitive interface and streamlined editing workflow.
