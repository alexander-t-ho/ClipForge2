import React, { useState } from 'react';

const Sidebar = ({ clips, onClipSelect, selectedClip, onAddToTimeline, onRemoveFromTimeline, onDeleteClip }) => {
  const [draggedClip, setDraggedClip] = useState(null);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getClipIcon = (clip) => {
    switch (clip.type) {
      case 'screen':
        return '🖥️';
      case 'webcam':
        return '📹';
      case 'imported':
      default:
        return '🎬';
    }
  };

  const getClipTypeLabel = (clip) => {
    switch (clip.type) {
      case 'screen':
        return 'Screen Capture';
      case 'webcam':
        return 'Webcam Recording';
      case 'imported':
      default:
        return 'Imported Video';
    }
  };

  const handleDragStart = (e, clip) => {
    setDraggedClip(clip);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clip.id);
  };

  const handleDragEnd = () => {
    setDraggedClip(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3 className="sidebar-title">Media Library</h3>
        <p className="sidebar-subtitle">{clips.length} clips imported</p>
      </div>
      
      <div className="clips-list">
        {clips.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#666666',
            fontSize: '14px'
          }}>
            No clips imported yet.<br />
            Drag & drop video files or click Import.
          </div>
        ) : (
          clips.map(clip => (
            <div 
              key={clip.id}
              className={`clip-item ${selectedClip?.id === clip.id ? 'selected' : ''} ${draggedClip?.id === clip.id ? 'dragging' : ''}`}
              onClick={() => onClipSelect(clip)}
              draggable={!clip.onTimeline}
              onDragStart={(e) => handleDragStart(e, clip)}
              onDragEnd={handleDragEnd}
            >
              <div className="clip-thumbnail">
                {getClipIcon(clip)}
              </div>
              <div className="clip-info">
                <div className="clip-name">{clip.name}</div>
                <div className="clip-type">{getClipTypeLabel(clip)}</div>
                <div className="clip-duration">{formatDuration(clip.duration)}</div>
              </div>
              <div className="clip-actions">
                {clip.onTimeline ? (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromTimeline(clip.id);
                    }}
                    title="Remove from timeline"
                  >
                    ➖
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToTimeline(clip.id);
                    }}
                    title="Add to timeline"
                  >
                    ➕
                  </button>
                )}
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to delete "${clip.name}"?`)) {
                      onDeleteClip(clip.id);
                    }
                  }}
                  title="Delete clip"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
