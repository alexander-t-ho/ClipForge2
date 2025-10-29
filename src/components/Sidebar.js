import React, { useState, useCallback } from 'react';

const Sidebar = ({ 
  clips, 
  selectedClip, 
  onClipSelect, 
  onAddToTimeline, 
  onRemoveFromTimeline, 
  onDeleteClip,
  onDragFromSidebar 
}) => {
  const [draggedClip, setDraggedClip] = useState(null);

  const getClipIcon = useCallback((type) => {
    switch (type) {
      case 'screen_capture': return '🖥️';
      case 'webcam_capture': return '📹';
      default: return '🎬';
    }
  }, []);

  const handleDragStart = useCallback((e, clip) => {
    if (clip.onTimeline) return;
    
    setDraggedClip(clip);
    e.dataTransfer.setData('text/plain', clip.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedClip(null);
  }, []);

  const handleAddToTimeline = useCallback((clip) => {
    if (onAddToTimeline) {
      onAddToTimeline(clip.id, 0, 0); // Add to main track at start
    }
  }, [onAddToTimeline]);

  const handleRemoveFromTimeline = useCallback((clip) => {
    if (onRemoveFromTimeline) {
      onRemoveFromTimeline(clip.id);
    }
  }, [onRemoveFromTimeline]);

  const handleDeleteClip = useCallback((clip) => {
    if (window.confirm(`Delete "${clip.name}"?`)) {
      onDeleteClip(clip.id);
    }
  }, [onDeleteClip]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Media Library</h3>
        <span className="clip-count">{clips.length} clips</span>
      </div>
      
      <div className="sidebar-content">
        {clips.length === 0 ? (
          <div className="empty-state">
            <p>No clips imported yet.</p>
            <p>Drag & drop video files or click Import.</p>
          </div>
        ) : (
          <div className="clip-list">
            {clips.map(clip => (
              <div
                key={clip.id}
                className={`clip-item ${selectedClip?.id === clip.id ? 'selected' : ''} ${draggedClip?.id === clip.id ? 'dragging' : ''}`}
                draggable={!clip.onTimeline}
                onDragStart={(e) => handleDragStart(e, clip)}
                onDragEnd={handleDragEnd}
                onClick={() => onClipSelect(clip)}
              >
                <div className="clip-info">
                  <div className="clip-icon">{getClipIcon(clip.type)}</div>
                  <div className="clip-details">
                    <div className="clip-name">{clip.name}</div>
                    <div className="clip-duration">{Math.round(clip.duration * 100) / 100}s</div>
                  </div>
                </div>
                
                <div className="clip-actions">
                  {clip.onTimeline ? (
                    <button 
                      className="btn-small btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromTimeline(clip);
                      }}
                      title="Remove from timeline"
                    >
                      ➖
                    </button>
                  ) : (
                    <button 
                      className="btn-small btn-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToTimeline(clip);
                      }}
                      title="Add to timeline"
                    >
                      ➕
                    </button>
                  )}
                  
                  <button 
                    className="btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClip(clip);
                    }}
                    title="Delete clip"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;