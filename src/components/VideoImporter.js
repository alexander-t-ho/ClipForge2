import React, { useRef } from 'react';

const VideoImporter = ({ onImport, onClose }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        onImport(file);
      }
    });
    onClose();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#2a2a2a',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #444444',
          textAlign: 'center',
          maxWidth: '400px',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
          Import Video Files
        </h3>
        
        <p style={{ 
          margin: '0 0 24px 0', 
          color: '#888888',
          fontSize: '14px'
        }}>
          Select video files to import into your project
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary"
            onClick={handleClick}
          >
            📁 Choose Files
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <div style={{ 
          marginTop: '20px', 
          fontSize: '12px', 
          color: '#666666' 
        }}>
          Supported formats: MP4, MOV, WebM, AVI
        </div>
      </div>
    </div>
  );
};

export default VideoImporter;
