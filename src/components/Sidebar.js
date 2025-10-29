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
    // Only allow dragging clips that are not already on timeline
    // The draggable attribute should prevent this, but double-check
    if (clip.onTimeline) {
      e.preventDefault();
      return;
    }
    
    setDraggedClip(clip);
    e.dataTransfer.setData('text/plain', clip.id.toString());
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback with custom drag image
    if (e.dataTransfer.setDragImage) {
      const dragImage = document.createElement('div');
      dragImage.textContent = clip.name;
      dragImage.style.cssText = 'padding: 8px; background: rgba(0,0,0,0.8); color: white; border-radius: 4px; position: absolute; top: -1000px; pointer-events: none;';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    }
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
        <h3>M Kenya Documentary</h3>
        <div className="header-stats">
          <span className="clip-count">{clips.length} items</span>
          <span className="storage-size">3.47 GB</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Refresh">🔄</button>
          <button className="icon-btn" title="List View">📋</button>
          <div className="notification-badge">20</div>
        </div>
      </div>
      
      <div className="sidebar-content">
        {clips.length === 0 ? (
          <div className="empty-state">
            <p>No clips imported yet.</p>
            <p>Drag & drop video files or click Import.</p>
          </div>
        ) : (
          <div className="media-grid">
            {clips.map(clip => (
              <div
                key={clip.id}
                className={`media-item ${selectedClip?.id === clip.id ? 'selected' : ''} ${draggedClip?.id === clip.id ? 'dragging' : ''}`}
                draggable={!clip.onTimeline}
                onDragStart={(e) => handleDragStart(e, clip)}
                onDragEnd={handleDragEnd}
                onClick={() => onClipSelect(clip)}
              >
                <div className="media-thumbnail">
                  <video 
                    src={clip.url} 
                    muted 
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      // Ensure duration is set when metadata loads
                      if (!clip.duration && e.target.duration) {
                        // This will trigger a re-render when the parent updates the clip
                      }
                    }}
                  />
                  <div className="duration-overlay">
                    {clip.duration && !isNaN(clip.duration) 
                      ? `${Math.floor(clip.duration / 60)}:${Math.floor(clip.duration % 60).toString().padStart(2, '0')}`
                      : '--:--'
                    }
                  </div>
                  <div className="media-actions">
                    {clip.onTimeline ? (
                      <button 
                        className="action-btn remove"
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
                        className="action-btn add"
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
                      className="action-btn delete"
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
                <div className="media-info">
                  <div className="media-title">{clip.name}</div>
                  <div className="media-meta">
                    <span className="creator">Creator</span>
                    <span className="total-duration">
                      {clip.duration && !isNaN(clip.duration) 
                        ? `${Math.floor(clip.duration)}m`
                        : '--m'
                      }
                    </span>
                  </div>
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