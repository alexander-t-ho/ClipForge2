import React from 'react';

const Header = ({ onImportClick, onExportClick, onScreenCaptureClick, onWebcamClick, isPlaying, onPlayPause, isExporting, exportProgress, onToggleSidebar, showSidebar }) => {
  return (
    <header className="header">
      <div className="header-left">
        <div 
          className={`logo ${!showSidebar ? 'sidebar-hidden' : ''}`}
          onClick={onToggleSidebar}
          style={{ cursor: 'pointer' }}
          title={showSidebar ? 'Hide Media Library' : 'Show Media Library'}
        >
          ClipForge2
        </div>
      </div>
      
      <div className="header-right">
        <button 
          className={`btn btn-play ${isPlaying ? 'playing' : 'paused'}`}
          onClick={onPlayPause}
          disabled={isExporting}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={onImportClick}
          disabled={isExporting}
        >
          📁 Import Video
        </button>
        
        <button 
          className="btn btn-capture" 
          onClick={onScreenCaptureClick}
          disabled={isExporting}
          style={{ backgroundColor: '#4CAF50', borderColor: '#4CAF50' }}
        >
          🖥️ Screen Capture
        </button>
        
        <button 
          className="btn btn-capture" 
          onClick={onWebcamClick}
          disabled={isExporting}
          style={{ backgroundColor: '#2196F3', borderColor: '#2196F3' }}
        >
          📹 Webcam
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={onExportClick}
          disabled={isExporting}
        >
          {isExporting ? `💾 Exporting... ${Math.round(exportProgress)}%` : '💾 Export MP4'}
        </button>
        
        <div className="keyboard-shortcuts" title="Keyboard Shortcuts: Delete - Delete selected clip, S - Split clip at playhead">
          ⌨️
        </div>
      </div>
    </header>
  );
};

export default Header;
