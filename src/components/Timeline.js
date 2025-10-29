import React, { useState, useRef, useCallback } from 'react';

// Constants
const CONFIG = {
  PIXELS_PER_SECOND: 30,
  TRACK_HEIGHT: 45,
  MIN_CLIP_DURATION: 0.1,
  SNAP_THRESHOLD: 0.3
};

const TRACKS = [
  { id: 0, name: 'Main Video', color: '#007AFF' },
  { id: 1, name: 'Overlay/PiP', color: '#34C759' },
  { id: 2, name: 'Audio', color: '#FF9500' }
];

const Timeline = ({ 
  clips, 
  currentTime, 
  onTimeChange, 
  zoom, 
  selectedClip, 
  onClipSelect,
  onDeleteClip,
  onSplitClip,
  onDragFromSidebar
}) => {
  const timelineRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const pixelsPerSecond = CONFIG.PIXELS_PER_SECOND * zoom;

  // Snap to position helper
  const snapToPosition = useCallback((position, excludeClipId = null) => {
    if (!snapEnabled) return position;

    const trackClips = clips.filter(clip => clip.track === (clips.find(c => c.id === excludeClipId)?.track || 0));
    let snappedPosition = position;

    // Snap to grid (1 second intervals)
    const gridPosition = Math.round(position);
    if (Math.abs(position - gridPosition) < 0.2) {
      snappedPosition = gridPosition;
    }

    // Snap to other clips
    const snapThreshold = CONFIG.SNAP_THRESHOLD;
    let closestSnap = null;
    let closestDistance = Infinity;

    trackClips.forEach(clip => {
      if (clip.id === excludeClipId) return;
      
      const distanceToStart = Math.abs(position - clip.startTime);
      const distanceToEnd = Math.abs(position - clip.endTime);
      
      if (distanceToStart < snapThreshold && distanceToStart < closestDistance) {
        closestSnap = clip.startTime;
        closestDistance = distanceToStart;
      }
      
      if (distanceToEnd < snapThreshold && distanceToEnd < closestDistance) {
        closestSnap = clip.endTime;
        closestDistance = distanceToEnd;
      }
    });

    if (closestSnap !== null) {
      snappedPosition = closestSnap;
    }

    return snappedPosition;
  }, [snapEnabled, clips]);

  // Handle timeline click
  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    
    onTimeChange(Math.max(0, time));
  }, [pixelsPerSecond, onTimeChange]);

  // Handle clip drag
  const handleClipDrag = useCallback((clipId, e) => {
    e.preventDefault();
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const newTime = Math.max(0, x / pixelsPerSecond);
      const snappedTime = snapToPosition(newTime, clipId);
      
      // Update clip position
      onClipUpdate(prev => prev.map(clip => 
        clip.id === clipId 
          ? { ...clip, startTime: snappedTime, endTime: snappedTime + (clip.endTime - clip.startTime) }
          : clip
      ));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerSecond, snapToPosition, onClipUpdate]);

  // Handle trim
  const handleTrim = useCallback((clipId, handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const handleMouseMove = (moveEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const newTime = Math.max(0, x / pixelsPerSecond);
      
      onClipUpdate(prev => prev.map(clip => {
        if (clip.id !== clipId) return clip;
        
        if (handle === 'start') {
          const newStartTime = Math.min(newTime, clip.endTime - CONFIG.MIN_CLIP_DURATION);
          return { ...clip, startTime: newStartTime };
        } else {
          const newEndTime = Math.max(newTime, clip.startTime + CONFIG.MIN_CLIP_DURATION);
          return { ...clip, endTime: newEndTime };
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerSecond, onClipUpdate]);

  // Handle drag from sidebar
  const handleTimelineDrop = useCallback((e) => {
    e.preventDefault();
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);
    const trackId = Math.floor((e.clientY - rect.top) / CONFIG.TRACK_HEIGHT);
    
    const clipId = parseInt(e.dataTransfer.getData('text/plain'));
    if (clipId && onDragFromSidebar) {
      onDragFromSidebar(clipId, trackId, time);
    }
  }, [pixelsPerSecond, onDragFromSidebar]);

  const handleTimelineDragOver = useCallback((e) => e.preventDefault(), []);

  return (
    <div className="timeline">
      <div className="timeline-header">
        <div className="timeline-controls">
          <button 
            className={`btn ${snapEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Toggle snapping"
          >
            🔗 Snap
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={() => {
              if (selectedClip && onSplitClip) {
                onSplitClip(selectedClip.id, currentTime);
              }
            }}
            disabled={!selectedClip}
            title="Split clip at playhead (S key)"
          >
            ✂️ Split
          </button>
        </div>
        
        <div className="timeline-zoom">
          <button onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}>+</button>
        </div>
      </div>

      <div 
        ref={timelineRef}
        className="timeline-content"
        onClick={handleTimelineClick}
        onDrop={handleTimelineDrop}
        onDragOver={handleTimelineDragOver}
      >
        {/* Time ruler */}
        <div className="timeline-ruler">
          {Array.from({ length: Math.ceil(30 / zoom) }, (_, i) => (
            <div 
              key={i} 
              className="timeline-marker"
              style={{ left: i * pixelsPerSecond }}
            >
              {i}s
            </div>
          ))}
        </div>

        {/* Playhead */}
        <div 
          className="timeline-playhead"
          style={{ left: currentTime * pixelsPerSecond }}
        />

        {/* Timeline tracks */}
        <div className="timeline-tracks">
          {TRACKS.map(track => (
            <div key={track.id} className="timeline-track" style={{ height: CONFIG.TRACK_HEIGHT }}>
              <div className="timeline-track-label" style={{ backgroundColor: track.color }}>
                {track.name}
              </div>
              
              <div className="timeline-track-content">
                {clips
                  .filter(clip => clip.track === track.id)
                  .map(clip => (
                    <div
                      key={clip.id}
                      className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                      style={{
                        left: clip.startTime * pixelsPerSecond,
                        width: (clip.endTime - clip.startTime) * pixelsPerSecond,
                        backgroundColor: track.color
                      }}
                      onMouseDown={(e) => handleClipDrag(clip.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClipSelect(clip);
                      }}
                    >
                      <div className="clip-name">{clip.name}</div>
                      <div className="clip-duration">
                        {Math.round((clip.endTime - clip.startTime) * 100) / 100}s
                      </div>
                      
                      {/* Trim handles */}
                      <div 
                        className="trim-handle trim-start"
                        onMouseDown={(e) => handleTrim(clip.id, 'start', e)}
                      />
                      <div 
                        className="trim-handle trim-end"
                        onMouseDown={(e) => handleTrim(clip.id, 'end', e)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;