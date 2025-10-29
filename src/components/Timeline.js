import React, { useState, useRef, useCallback } from 'react';

// Constants
const CONFIG = {
  PIXELS_PER_SECOND: 30,
  TRACK_HEIGHT: 80,
  MIN_CLIP_DURATION: 0.1,
  SNAP_THRESHOLD: 0.3,
  CURSOR_OFFSET: 80, // Minimal offset - aligns cursor/0:00 with start of tracks
  VIDEO_START_OFFSET: 80, // Videos start at same offset as cursor so they align
  TIMELINE_SCALE_INTERVAL: 10 // 10 second intervals (matches reference)
};

const TRACKS = [
  { id: 0, name: '', color: '#007AFF' },
  { id: 1, name: '', color: '#34C759' },
  { id: 2, name: '', color: '#FF9500' }
];

const Timeline = ({ 
  clips, 
  currentTime, 
  onTimeChange, 
  onClipUpdate,
  zoom, 
  onZoomChange,
  selectedClip, 
  onClipSelect,
  onDeleteClip,
  onSplitClip,
  onDragFromSidebar,
  isPlaying,
  onPlayPause,
  // Clipping props
  isClippingMode,
  clippingStartTime,
  clippingEndTime,
  onStartClipping,
  onEndClipping,
  onCancelClipping,
  onUpdateClippingWindow,
  onTimelineClickClipping,
  isDraggingClippingWindow,
  onSetDraggingClippingWindow
}) => {
  const timelineRef = useRef(null);
  const timelineContentRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const pixelsPerSecond = CONFIG.PIXELS_PER_SECOND * zoom;

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate total timeline duration (max endTime of all clips)
  const totalDuration = clips.length > 0 ? Math.max(...clips.map(clip => clip.endTime || 0)) : 0;

  // Calculate timeline scale markers (10 second intervals)
  const getTimelineMarkers = useCallback(() => {
    const markers = [];
    // Timeline duration is the maximum endTime of all clips on the timeline
    // Use exact duration, or minimum 60 seconds if no clips
    const maxTime = Math.max(60, totalDuration);
    const interval = CONFIG.TIMELINE_SCALE_INTERVAL;

    for (let time = 0; time <= maxTime; time += interval) {
      markers.push({
        time,
        position: CONFIG.CURSOR_OFFSET + (time * pixelsPerSecond)
      });
    }

    return markers;
  }, [totalDuration, pixelsPerSecond]);

  const timelineMarkers = getTimelineMarkers();

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
    const x = e.clientX - rect.left - CONFIG.CURSOR_OFFSET;
    const time = Math.max(0, x / pixelsPerSecond); // Never allow negative time

    if (isClippingMode && onTimelineClickClipping) {
      onTimelineClickClipping(time);
    } else {
      onTimeChange(time);
    }
  }, [pixelsPerSecond, onTimeChange, isClippingMode, onTimelineClickClipping]);

  // Handle playhead drag
  const handlePlayheadDrag = useCallback((e) => {
    if (!timelineRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    
    const handleMouseMove = (moveEvent) => {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - CONFIG.CURSOR_OFFSET;
      const newTime = Math.max(0, x / pixelsPerSecond);
      onTimeChange(newTime);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerSecond, onTimeChange]);

  // Handle clip drag
  const handleClipDrag = useCallback((clipId, e) => {
    e.preventDefault();
    setIsDragging(true);
    
    // Get original clip state from current clips prop (captured at drag start)
    const originalClip = clips.find(clip => clip.id === clipId);
    if (!originalClip) return;
    
    const originalStartTime = originalClip.startTime;
    const originalEndTime = originalClip.endTime;
    const originalDuration = originalEndTime - originalStartTime;
    const originalTrack = originalClip.track;
    
    const handleMouseMove = (moveEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - CONFIG.CURSOR_OFFSET;
      const newTime = Math.max(0, x / pixelsPerSecond);
      const snappedTime = snapToPosition(newTime, clipId);
      
      onClipUpdate(prev => {
        const newStartTime = snappedTime;
        const newEndTime = newStartTime + originalDuration;
        
        // Find clips on the same track that would overlap
        const otherClips = prev.filter(clip => 
          clip.id !== clipId && 
          clip.onTimeline && 
          clip.track === originalTrack
        );
        
        // Check for overlap with any other clip
        const overlappingClip = otherClips.find(otherClip => {
          // Check if new position overlaps with existing clip
          return (newStartTime < otherClip.endTime && newEndTime > otherClip.startTime);
        });
        
        if (overlappingClip) {
          // When videos overlay each other, they switch positions
          // Dragged clip goes to other clip's position, other clip goes to dragged clip's original position
          const otherClipDuration = overlappingClip.endTime - overlappingClip.startTime;
          
          return prev.map(clip => {
            if (clip.id === clipId) {
              // Move dragged clip to the other clip's position
              return {
                ...clip,
                startTime: overlappingClip.startTime,
                endTime: overlappingClip.startTime + originalDuration
              };
            } else if (clip.id === overlappingClip.id) {
              // Move other clip to the dragged clip's original position
              return {
                ...clip,
                startTime: originalStartTime,
                endTime: originalStartTime + otherClipDuration
              };
            }
            return clip;
          });
        } else {
          // No overlap - normal movement
          return prev.map(clip => 
            clip.id === clipId 
              ? { ...clip, startTime: newStartTime, endTime: newEndTime }
              : clip
          );
        }
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerSecond, snapToPosition, onClipUpdate, clips]);

  // Handle trim
  const handleTrim = useCallback((clipId, handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const handleMouseMove = (moveEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - CONFIG.CURSOR_OFFSET;
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
    e.stopPropagation();
    
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - CONFIG.CURSOR_OFFSET;
    const time = Math.max(0, x / pixelsPerSecond);
    
    // Calculate which track based on Y position
    // Account for ruler height (~40px) at the top
    const rulerHeight = 40;
    const trackY = e.clientY - rect.top - rulerHeight;
    let trackId = Math.floor(trackY / CONFIG.TRACK_HEIGHT);
    
    // Clamp track ID to valid range (0 to TRACKS.length - 1)
    trackId = Math.max(0, Math.min(TRACKS.length - 1, trackId));
    
    const clipId = parseInt(e.dataTransfer.getData('text/plain'));
    if (clipId && !isNaN(clipId) && onDragFromSidebar) {
      // Use the drop position as the start time
      onDragFromSidebar(clipId, trackId, time);
    }
  }, [pixelsPerSecond, onDragFromSidebar]);

  const handleTimelineDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Clipping window handlers
  const handleClippingWindowDrag = useCallback((e) => {
    if (!isClippingMode || !timelineRef.current) return;
    
    e.preventDefault();
    onSetDraggingClippingWindow(true);
    
    const handleMouseMove = (moveEvent) => {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - CONFIG.CURSOR_OFFSET;
      const newTime = Math.max(0, x / pixelsPerSecond);
      
      onUpdateClippingWindow(newTime);
    };

    const handleMouseUp = () => {
      onSetDraggingClippingWindow(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isClippingMode, pixelsPerSecond, onUpdateClippingWindow, onSetDraggingClippingWindow]);

  const handleClippingHandleDrag = useCallback((handle, e) => {
    if (!isClippingMode || !timelineRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow dragging the right edge (end handle)
    if (handle === 'start') {
      return; // Disable left edge dragging
    }
    
    const handleMouseMove = (moveEvent) => {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left - CONFIG.CURSOR_OFFSET;
      const newTime = Math.max(0, x / pixelsPerSecond);
      
      // Only update end time, ensuring it's at least 0.1s after start
      const minEndTime = clippingStartTime + 0.1;
      onUpdateClippingWindow(Math.max(newTime, minEndTime));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isClippingMode, pixelsPerSecond, clippingStartTime, onUpdateClippingWindow]);

  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <button className="timeline-play-button" onClick={onPlayPause}>
          <svg viewBox="0 0 24 24">
            <path d={isPlaying ? "M6 4h4v16H6V4zm8 0h4v16h-4V4z" : "M8 5v14l11-7z"}/>
          </svg>
        </button>
        
        {/* Clipping controls */}
        <div className="clipping-controls">
          <button 
            className={isClippingMode ? "clip-confirm-button" : "clip-button"} 
            onClick={isClippingMode ? onEndClipping : onStartClipping}
            disabled={!isClippingMode && !selectedClip}
            title={isClippingMode ? "Save Clip" : "Start Clipping"}
          >
            {isClippingMode ? "✓ Save Clip" : "✂️ Clip"}
          </button>
          {isClippingMode && (
            <button 
              className="clip-cancel-button" 
              onClick={onCancelClipping}
              title="Cancel Clipping"
            >
              ✕ Cancel
            </button>
          )}
        </div>
        
        <div className="timeline-timecode">
          {formatTime(currentTime)} / {formatTime(totalDuration || 30)}
        </div>
        <div className="timeline-zoom-controls">
          <button className="timeline-zoom-btn" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}>-</button>
          <span className="timeline-zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="timeline-zoom-btn" onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}>+</button>
        </div>
      </div>
      
      <div 
        className="timeline-content" 
        ref={timelineContentRef} 
        onClick={handleTimelineClick}
        onDrop={handleTimelineDrop}
        onDragOver={handleTimelineDragOver}
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
      >
        <div 
          className="timeline-ruler" 
          ref={timelineRef}
          style={{ 
            width: `${CONFIG.CURSOR_OFFSET + (totalDuration || 60) * pixelsPerSecond}px`,
            minWidth: '100%'
          }}
        >
          {/* Timeline scale markers */}
          {timelineMarkers.map(marker => (
            <div
              key={marker.time}
              className="timeline-marker"
              style={{ left: marker.position }}
            >
              <div className="marker-line"></div>
              <div className="marker-label">{formatTime(marker.time)}</div>
            </div>
          ))}
        </div>
        
        <div 
          className="timeline-tracks"
          style={{ 
            width: `${CONFIG.CURSOR_OFFSET + (totalDuration || 60) * pixelsPerSecond}px`,
            minWidth: '100%'
          }}
        >
          {TRACKS.map(track => (
            <div key={track.id} className="track">
              <div className="track-content">
                {clips
                  .filter(clip => clip.track === track.id)
                  .sort((a, b) => a.startTime - b.startTime)
                  .map((clip, index, array) => {
                    const prevClip = index > 0 ? array[index - 1] : null;
                    const spacing = prevClip ? Math.max(2, (clip.startTime - prevClip.endTime) * pixelsPerSecond) : 0;
                    
                    return (
                      <React.Fragment key={clip.id}>
                        {/* Spacing between clips */}
                        {spacing > 0 && (
                          <div 
                            className="clip-spacing"
                            style={{ 
                              left: CONFIG.VIDEO_START_OFFSET + prevClip.endTime * pixelsPerSecond,
                              width: spacing
                            }}
                          />
                        )}
                        
                        <div
                          className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                          style={{
                            left: CONFIG.VIDEO_START_OFFSET + clip.startTime * pixelsPerSecond,
                            width: (clip.endTime - clip.startTime) * pixelsPerSecond,
                            backgroundColor: track.color
                          }}
                          onMouseDown={(e) => handleClipDrag(clip.id, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClipSelect(clip);
                          }}
                        >
                          {/* Video frames background */}
                          <div className="clip-video-frames">
                            <video 
                              src={clip.url}
                              muted
                              preload="metadata"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.7
                              }}
                            />
                          </div>
                          
                          {/* Clean clip content - no labels */}
                          <div className="clip-content">
                            {/* Optional: Just the clip name without duration */}
                            <div className="clip-name">{clip.name}</div>
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
                      </React.Fragment>
                    );
                  })}
                {clips.filter(clip => clip.track === track.id).length === 0 && (
                  <div className="empty-track">
                    <div className="empty-track-icon">📽️</div>
                    <div>Drag material here and start to create</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Clipping Window Overlay */}
          {isClippingMode && selectedClip && (
            <div className="clipping-window-overlay">
              <div
                className="clipping-window"
                style={{
                  left: CONFIG.CURSOR_OFFSET + Math.min(clippingStartTime, clippingEndTime) * pixelsPerSecond,
                  width: Math.abs(clippingEndTime - clippingStartTime) * pixelsPerSecond,
                  height: TRACKS.length * CONFIG.TRACK_HEIGHT
                }}
                // Disable dragging the whole window - only allow right edge
              >
                <div className="clipping-window-content">
                  <div className="clipping-info">
                    <div className="clipping-duration">
                      {formatTime(Math.abs(clippingEndTime - clippingStartTime))}
                    </div>
                    <div className="clipping-range">
                      {formatTime(Math.min(clippingStartTime, clippingEndTime))} - {formatTime(Math.max(clippingStartTime, clippingEndTime))}
                    </div>
                  </div>
                  
                  {/* Clipping handles - only right edge is draggable */}
                  <div 
                    className="clipping-handle clipping-handle-start"
                    style={{ cursor: 'not-allowed', opacity: 0.5 }}
                    title="Start point fixed"
                  />
                  <div 
                    className="clipping-handle clipping-handle-end"
                    onMouseDown={(e) => handleClippingHandleDrag('end', e)}
                    style={{ cursor: 'ew-resize' }}
                    title="Drag to extend clip"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Playhead */}
          <div 
            className={`timeline-playhead ${isDraggingPlayhead ? 'dragging' : ''}`}
            style={{ left: CONFIG.CURSOR_OFFSET + currentTime * pixelsPerSecond }}
            onMouseDown={handlePlayheadDrag}
          >
            <div className="playhead-handle"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;