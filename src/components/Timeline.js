import React, { useState, useRef, useEffect, useCallback } from 'react';

// Constants
const TIMELINE_CONFIG = {
  PIXELS_PER_SECOND: 30,
  TRACK_HEIGHT: 45,
  TRACK_SPACING: 5,
  MIN_CLIP_DURATION: 0.1,
  SNAP_THRESHOLD: 0.3,
  GRID_SIZE: 1
};

const TRACKS = [
  { id: 0, name: 'Main Video', type: 'video', color: '#007AFF' },
  { id: 1, name: 'Overlay/PiP', type: 'overlay', color: '#34C759' },
  { id: 2, name: 'Audio', type: 'audio', color: '#FF9500' }
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
  onDragFromSidebar
}) => {
  const timelineRef = useRef(null);
  const timelineContentRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimHandle, setTrimHandle] = useState(null);
  const [isDraggingFromSidebar, setIsDraggingFromSidebar] = useState(false);
  const [dragPreview, setDragPreview] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToClips, setSnapToClips] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  const pixelsPerSecond = TIMELINE_CONFIG.PIXELS_PER_SECOND * zoom;
  const trackHeight = TIMELINE_CONFIG.TRACK_HEIGHT;
  const trackSpacing = TIMELINE_CONFIG.TRACK_SPACING;

  // Find next available position for a clip on a specific track
  const findNextAvailablePosition = useCallback((trackId, clipDuration) => {
    const trackClips = clips.filter(clip => clip.track === trackId);
    
    if (trackClips.length === 0) {
      return 0; // First clip starts at 0
    }

    // Sort clips by start time
    const sortedClips = trackClips.sort((a, b) => a.startTime - b.startTime);
    
    // Check if there's space at the beginning
    if (sortedClips[0].startTime >= clipDuration) {
      return 0;
    }

    // Check for gaps between clips
    for (let i = 0; i < sortedClips.length - 1; i++) {
      const currentClip = sortedClips[i];
      const nextClip = sortedClips[i + 1];
      const gap = nextClip.startTime - currentClip.endTime;
      
      if (gap >= clipDuration) {
        return currentClip.endTime;
      }
    }

    // Place after the last clip
    const lastClip = sortedClips[sortedClips.length - 1];
    return lastClip.endTime;
  }, [clips]);

  // Handle keyboard events for timeline
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedClip) {
        if (window.confirm(`Are you sure you want to delete "${selectedClip.name}"?`)) {
          onDeleteClip(selectedClip.id);
        }
      } else if (e.key === 's' && e.ctrlKey && selectedClip) {
        // Split clip at playhead
        e.preventDefault();
        if (onSplitClip) {
          onSplitClip(selectedClip.id, currentTime);
        }
      } else if (e.key === 's' && selectedClip) {
        // Split clip at playhead (without Ctrl)
        e.preventDefault();
        if (onSplitClip) {
          onSplitClip(selectedClip.id, currentTime);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip, onDeleteClip, onSplitClip, currentTime]);

  const timelineWidth = Math.max(2000, clips.reduce((max, clip) => 
    Math.max(max, clip.endTime * pixelsPerSecond + 200), 0
  ));

  // Handle horizontal scrolling
  const handleScroll = (e) => {
    setScrollPosition(e.target.scrollLeft);
  };

  // Auto-scroll to show playhead
  useEffect(() => {
    if (timelineContentRef.current) {
      const playheadPosition = currentTime * pixelsPerSecond;
      const containerWidth = timelineContentRef.current.clientWidth;
      const currentScroll = timelineContentRef.current.scrollLeft;
      
      // If playhead is outside visible area, scroll to it
      if (playheadPosition < currentScroll || playheadPosition > currentScroll + containerWidth) {
        timelineContentRef.current.scrollLeft = Math.max(0, playheadPosition - containerWidth / 2);
      }
    }
  }, [currentTime, pixelsPerSecond]);

  // Enhanced snap functionality with magnet behavior
  const snapToPosition = useCallback((position, excludeClipId = null, clipDuration = 0) => {
    if (!snapEnabled) return position;

    let snappedPosition = position;
    const trackClips = clips.filter(clip => clip.track === (clips.find(c => c.id === excludeClipId)?.track || 0));

    if (snapToGrid) {
      const gridSize = TIMELINE_CONFIG.GRID_SIZE;
      const gridPosition = Math.round(position / gridSize) * gridSize;
      if (Math.abs(position - gridPosition) < 0.2) {
        snappedPosition = gridPosition;
      }
    }

    if (snapToClips) {
      // Find the closest clip edge to snap to
      const snapThreshold = TIMELINE_CONFIG.SNAP_THRESHOLD;
      let closestSnap = null;
      let closestDistance = Infinity;

      trackClips.forEach(clip => {
        if (clip.id === excludeClipId) return;
        
        const clipStart = clip.startTime;
        const clipEnd = clip.endTime;
        
        // Check snapping to start of clip
        const distanceToStart = Math.abs(position - clipStart);
        if (distanceToStart < snapThreshold && distanceToStart < closestDistance) {
          closestSnap = clipStart;
          closestDistance = distanceToStart;
        }
        
        // Check snapping to end of clip
        const distanceToEnd = Math.abs(position - clipEnd);
        if (distanceToEnd < snapThreshold && distanceToEnd < closestDistance) {
          closestSnap = clipEnd;
          closestDistance = distanceToEnd;
        }
      });

      if (closestSnap !== null) {
        snappedPosition = closestSnap;
      }
    }

    // Ensure no overlap with other clips
    const finalPosition = ensureNoOverlap(snappedPosition, clipDuration, excludeClipId, trackClips);
    
    return finalPosition;
  }, [snapEnabled, snapToGrid, snapToClips, clips]);

  // Ensure no overlap with other clips
  const ensureNoOverlap = useCallback((position, duration, excludeClipId, trackClips) => {
    const endPosition = position + duration;
    
    // Check for overlaps
    for (const clip of trackClips) {
      if (clip.id === excludeClipId) continue;
      
      const clipStart = clip.startTime;
      const clipEnd = clip.endTime;
      
      // Check if there's an overlap
      if ((position < clipEnd && endPosition > clipStart)) {
        // Move to the end of the overlapping clip
        return clipEnd;
      }
    }
    
    return position;
  }, []);

  const handleTimelineClick = (e) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = snapToPosition(x / pixelsPerSecond);
      onTimeChange(time);
    }
  };

  const handleClipDrag = (clipId, e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, clipId });
  };

  const handleClipDragEnd = (e) => {
    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaTime = deltaX / pixelsPerSecond;
      
      onClipUpdate(prevClips => 
        prevClips.map(clip => {
          if (clip.id === dragStart.clipId) {
            const duration = clip.endTime - clip.startTime;
            const newStartTime = snapToPosition(
              Math.max(0, clip.startTime + deltaTime), 
              clip.id, 
              duration
            );
            return { 
              ...clip, 
              startTime: newStartTime,
              endTime: newStartTime + duration
            };
          }
          return clip;
        })
      );
    }
    
    setIsDragging(false);
    setDragStart(null);
    setIsTrimming(false);
    setTrimHandle(null);
  };

  const handleTrimStart = (clipId, handle, e) => {
    e.stopPropagation();
    setIsTrimming(true);
    setTrimHandle({ clipId, handle, startX: e.clientX });
  };

  const handleTrimMove = (e) => {
    if (isTrimming && trimHandle) {
      const deltaX = e.clientX - trimHandle.startX;
      const deltaTime = deltaX / pixelsPerSecond;
      
      onClipUpdate(prevClips => 
        prevClips.map(clip => {
          if (clip.id === trimHandle.clipId) {
            if (trimHandle.handle === 'start') {
              const newStartTime = snapToPosition(
                Math.max(0, clip.startTime + deltaTime), 
                clip.id, 
                0
              );
              return { 
                ...clip, 
                startTime: Math.min(newStartTime, clip.endTime - TIMELINE_CONFIG.MIN_CLIP_DURATION)
              };
            } else if (trimHandle.handle === 'end') {
              const newEndTime = snapToPosition(
                Math.max(clip.startTime + TIMELINE_CONFIG.MIN_CLIP_DURATION, clip.endTime + deltaTime), 
                clip.id, 
                0
              );
              return { ...clip, endTime: newEndTime };
            }
          }
          return clip;
        })
      );
    }
  };

  // Handle drag from sidebar
  const handleTimelineDragOver = (e) => {
    e.preventDefault();
    if (isDraggingFromSidebar) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = snapToPosition(x / pixelsPerSecond);
      setDragPreview({ time, track: 0 });
    }
  };

  const handleTimelineDrop = (e) => {
    e.preventDefault();
    if (isDraggingFromSidebar && onDragFromSidebar) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = snapToPosition(x / pixelsPerSecond);
      onDragFromSidebar(time, 0); // Default to track 0
    }
    setIsDraggingFromSidebar(false);
    setDragPreview(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const generateTimeMarkers = () => {
    const markers = [];
    const interval = zoom > 2 ? 0.5 : zoom > 1 ? 1 : 5; // seconds between markers
    
    for (let i = 0; i <= timelineWidth / pixelsPerSecond; i += interval) {
      const isMajorMarker = i % (interval * 5) === 0;
      markers.push(
        <div
          key={i}
          className={`time-marker ${isMajorMarker ? 'major' : 'minor'}`}
          style={{
            left: i * pixelsPerSecond,
            position: 'absolute',
            height: '100%',
            width: '1px',
            backgroundColor: isMajorMarker ? '#888888' : '#555555',
            fontSize: '10px',
            color: '#888888',
            paddingTop: '4px'
          }}
        >
          {isMajorMarker && formatTime(i)}
        </div>
      );
    }
    return markers;
  };

  const getClipsForTrack = (trackId) => {
    return clips.filter(clip => clip.track === trackId);
  };

  const getTrackColor = (trackType) => {
    switch (trackType) {
      case 'video': return '#007AFF';
      case 'overlay': return '#34C759';
      case 'audio': return '#FF9500';
      default: return '#007AFF';
    }
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3 className="timeline-title">Timeline</h3>
        <div className="timeline-controls">
          <div className="snap-controls">
            <button 
              className={`btn ${snapEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
              title="Toggle snap"
            >
              🧲
            </button>
            <button 
              className={`btn ${snapToGrid ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Snap to grid"
            >
              📐
            </button>
            <button 
              className={`btn ${snapToClips ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSnapToClips(!snapToClips)}
              title="Snap to clips"
            >
              🔗
            </button>
          </div>
          <div className="edit-controls">
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
          <div className="zoom-controls">
            <button 
              className="btn btn-secondary"
              onClick={() => onZoomChange(Math.max(0.1, zoom - 0.2))}
            >
              🔍−
            </button>
            <span style={{ fontSize: '12px', margin: '0 8px' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button 
              className="btn btn-secondary"
              onClick={() => onZoomChange(Math.min(5, zoom + 0.2))}
            >
              🔍+
            </button>
          </div>
        </div>
      </div>
      
      <div 
        className="timeline-content"
        ref={timelineContentRef}
        onClick={handleTimelineClick}
        onMouseUp={handleClipDragEnd}
        onMouseMove={handleTrimMove}
        onDragOver={handleTimelineDragOver}
        onDrop={handleTimelineDrop}
        onScroll={handleScroll}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
      >
        <div className="timeline-ruler">
          {generateTimeMarkers()}
          {/* Current time indicator */}
          <div 
            className="timeline-playhead"
            style={{ left: currentTime * pixelsPerSecond }}
          />
        </div>
        
        <div className="timeline-tracks" style={{ width: timelineWidth }}>
          {TRACKS.map(track => (
            <div key={track.id} className="timeline-track" style={{ height: trackHeight }}>
              <div 
                className="timeline-track-label"
                style={{ 
                  backgroundColor: getTrackColor(track.type),
                  color: 'white'
                }}
              >
                {track.name}
              </div>
              
              <div className="timeline-track-content">
                {getClipsForTrack(track.id).map(clip => (
                  <div
                    key={clip.id}
                    className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                    style={{
                      left: clip.startTime * pixelsPerSecond,
                      width: (clip.endTime - clip.startTime) * pixelsPerSecond,
                      backgroundColor: getTrackColor(track.type),
                      height: trackHeight - 4,
                      top: 2
                    }}
                    onMouseDown={(e) => handleClipDrag(clip.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClipSelect(clip);
                    }}
                  >
                    {/* Trim handles */}
                    <div 
                      className="trim-handle trim-handle-start"
                      onMouseDown={(e) => handleTrimStart(clip.id, 'start', e)}
                    />
                    <div 
                      className="trim-handle trim-handle-end"
                      onMouseDown={(e) => handleTrimStart(clip.id, 'end', e)}
                    />
                    
                    {/* Clip content */}
                    <div className="clip-content">
                      <div className="clip-name">{clip.name}</div>
                      <div className="clip-duration">
                        {formatTime(clip.endTime - clip.startTime)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Drag preview */}
                {dragPreview && dragPreview.track === track.id && (
                  <div
                    className="drag-preview"
                    style={{
                      left: dragPreview.time * pixelsPerSecond,
                      height: trackHeight - 4,
                      top: 2
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Timeline footer with current time */}
      <div className="timeline-footer">
        <div className="current-time">
          Current Time: {formatTime(currentTime)}
        </div>
        <div className="timeline-info">
          {clips.length} clips • {tracks.length} tracks
        </div>
        <div className="scroll-info">
          Scroll: {Math.round(scrollPosition / pixelsPerSecond)}s
        </div>
      </div>
    </div>
  );
};

export default Timeline;