import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// Components
import Timeline from './components/Timeline';
import VideoImporter from './components/VideoImporter';
import MediaCapture from './components/MediaCapture';

// Constants
const CAPTURE_TYPES = { SCREEN: 'screen', WEBCAM: 'webcam' };
const CLIP_TYPES = { IMPORTED: 'imported', SCREEN_CAPTURE: 'screen_capture', WEBCAM_CAPTURE: 'webcam_capture' };

function App() {
  // Core state
  const [clips, setClips] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  
  // UI state
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [captureType, setCaptureType] = useState(CAPTURE_TYPES.SCREEN);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Clipping state
  const [isClippingMode, setIsClippingMode] = useState(false);
  const [clippingStartTime, setClippingStartTime] = useState(0);
  const [clippingEndTime, setClippingEndTime] = useState(0);
  const [isDraggingClippingWindow, setIsDraggingClippingWindow] = useState(false);

  const videoRef = useRef(null);

  // Create clip helper
  const createClip = useCallback((file, type, name) => ({
      id: Date.now(),
    name: name || file.name,
    file,
      url: URL.createObjectURL(file),
      duration: 0,
      startTime: 0,
      endTime: 0,
    position: 0,
    track: -1,
    type,
    onTimeline: false
  }), []);

  // Handle video import
  const handleVideoImport = useCallback((file) => {
    if (!file?.type.startsWith('video/')) return;
    
    const newClip = createClip(file, CLIP_TYPES.IMPORTED);
    const video = document.createElement('video');
    video.src = newClip.url;
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      console.log('Video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        newClip.duration = video.duration;
        newClip.endTime = video.duration;
        setClips(prev => [...prev, newClip]);
      } else {
        console.warn('Invalid video duration:', video.duration);
        // Still add the clip but with a default duration
        newClip.duration = 10; // Default 10 seconds
        newClip.endTime = 10;
        setClips(prev => [...prev, newClip]);
      }
    };
    
    video.onerror = (error) => {
      console.error('Video load error:', error);
      URL.revokeObjectURL(newClip.url);
    };
  }, [createClip]);

  // Handle media capture
  const handleMediaCapture = useCallback((file) => {
    if (!file) return;
    
    const clipType = captureType === CAPTURE_TYPES.SCREEN ? CLIP_TYPES.SCREEN_CAPTURE : CLIP_TYPES.WEBCAM_CAPTURE;
    const name = `${captureType === CAPTURE_TYPES.SCREEN ? 'Screen' : 'Webcam'} Recording ${new Date().toLocaleTimeString()}`;
    
    const newClip = createClip(file, clipType, name);
    const video = document.createElement('video');
    video.src = newClip.url;
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      console.log('Captured video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        newClip.duration = video.duration;
        newClip.endTime = video.duration;
        setClips(prev => [...prev, newClip]);
      } else {
        console.warn('Invalid captured video duration:', video.duration);
        // Still add the clip but with a default duration
        newClip.duration = 10; // Default 10 seconds
        newClip.endTime = 10;
        setClips(prev => [...prev, newClip]);
      }
    };
    
    video.onerror = (error) => {
      console.error('Captured video load error:', error);
      URL.revokeObjectURL(newClip.url);
    };
  }, [createClip, captureType]);

  // Load test video on startup
  useEffect(() => {
    const loadTestVideo = async () => {
      try {
        const response = await fetch('/test-video.mp4');
        const blob = await response.blob();
        const file = new File([blob], 'test-video.mp4', { type: 'video/mp4' });
        handleVideoImport(file);
      } catch (error) {
        console.log('Test video not found, continuing without it');
      }
    };
    
    loadTestVideo();
  }, [handleVideoImport]);

  // Event handlers
  const handleScreenCaptureClick = useCallback(() => {
    setCaptureType(CAPTURE_TYPES.SCREEN);
    setShowMediaCapture(true);
  }, []);

  const handleWebcamClick = useCallback(() => {
    setCaptureType(CAPTURE_TYPES.WEBCAM);
    setShowMediaCapture(true);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(handleVideoImport);
  }, [handleVideoImport]);

  const handleDragOver = useCallback((e) => e.preventDefault(), []);

  // Timeline functions
  const addClipToTimeline = useCallback((clipId, trackId, startTime) => {
    setClips(prev => prev.map(clip => {
      if (clip.id === clipId) {
        // Calculate duration: use clip.duration, or calculate from endTime - startTime if duration not set
        let duration = clip.duration;
        if (!duration || duration === 0) {
          // Try to calculate from endTime if available
          if (clip.endTime && clip.startTime !== undefined) {
            duration = clip.endTime - clip.startTime;
          } else {
            // Fallback: try to get from video element
            duration = 10; // Default fallback
          }
        }
        return { 
          ...clip, 
          onTimeline: true, 
          track: trackId, 
          startTime, 
          endTime: startTime + duration, // Set endTime based on startTime + duration
          position: startTime 
        };
      }
      return clip;
    }));
  }, []);

  const removeClipFromTimeline = useCallback((clipId) => {
    setClips(prev => prev.map(clip => 
      clip.id === clipId 
        ? { ...clip, onTimeline: false, track: -1, position: 0 }
        : clip
    ));
  }, []);

  const deleteClip = useCallback((clipId) => {
    setClips(prev => {
      const clip = prev.find(c => c.id === clipId);
      if (clip?.url) URL.revokeObjectURL(clip.url);
      return prev.filter(c => c.id !== clipId);
    });
  }, []);

  const splitClip = useCallback((clipId, splitTime) => {
    setClips(prev => {
      const clipToSplit = prev.find(clip => clip.id === clipId);
      if (!clipToSplit || splitTime <= clipToSplit.startTime || splitTime >= clipToSplit.endTime) {
        return prev;
      }

      const firstClip = { ...clipToSplit, endTime: splitTime, name: `${clipToSplit.name} (Part 1)` };
      const secondClip = { 
        ...clipToSplit, 
        id: Date.now(), 
        name: `${clipToSplit.name} (Part 2)`, 
        startTime: splitTime 
      };
      
      return prev.map(clip => clip.id === clipId ? [firstClip, secondClip] : clip).flat();
    });
  }, []);

  const handleDragFromSidebar = useCallback((clipId, trackId, startTime) => {
    addClipToTimeline(clipId, trackId, startTime);
  }, [addClipToTimeline]);

  const toggleSidebar = useCallback(() => setShowSidebar(prev => !prev), []);
  const toggleMediaLibrary = useCallback(() => setShowMediaLibrary(prev => !prev), []);

  // Clipping functions
  // Define endClipping first so startClipping can reference it
  const endClippingRef = useRef(null);
  
  const endClipping = useCallback(() => {
    if (!isClippingMode || !selectedClip) return;
    
    const startTime = clippingStartTime;
    const endTime = clippingEndTime;
    
    // Ensure minimum duration of 0.1 seconds
    if (endTime - startTime < 0.1) {
      // Too short, just exit clipping mode
      setIsClippingMode(false);
      return;
    }
    
    // Create a new clipped version - save to media library (not on timeline)
    const clippedClip = {
      ...selectedClip,
      id: Date.now(),
      name: `${selectedClip.name} (Clipped ${new Date().toLocaleTimeString()})`,
      startTime: 0, // Start of the clipped video is 0
      endTime: endTime - startTime, // Duration of the clipped segment
      duration: endTime - startTime,
      // Store the original clip info and the trim range
      originalClipId: selectedClip.id,
      trimStart: startTime,
      trimEnd: endTime,
      onTimeline: false, // Save to media library, not timeline
      type: selectedClip.type || CLIP_TYPES.IMPORTED,
      // Use the same file/URL - we'll handle playback with trim info
      file: selectedClip.file,
      url: selectedClip.url
    };
    
    setClips(prev => [...prev, clippedClip]);
    setIsClippingMode(false);
    // Don't change selected clip, keep the original selected
  }, [isClippingMode, selectedClip, clippingStartTime, clippingEndTime]);

  // Store ref for startClipping to use
  endClippingRef.current = endClipping;

  const startClipping = useCallback(() => {
    if (!selectedClip) return;
    
    // If already in clipping mode, save the clip (toggle behavior)
    if (isClippingMode && endClippingRef.current) {
      endClippingRef.current();
      return;
    }
    
    // Start clipping from current cursor position with minimum 0.1s duration
    setIsClippingMode(true);
    setClippingStartTime(currentTime);
    setClippingEndTime(currentTime + 0.1); // Minimum size of 0.1 seconds
  }, [currentTime, selectedClip, isClippingMode]);


  const cancelClipping = useCallback(() => {
    setIsClippingMode(false);
    setClippingStartTime(0);
    setClippingEndTime(0);
  }, []);

  const updateClippingWindow = useCallback((newTime) => {
    if (!isClippingMode) return;
    
    // Only allow dragging the right edge - ensure endTime is always >= startTime + 0.1
    const minEndTime = clippingStartTime + 0.1;
    const newEndTime = Math.max(newTime, minEndTime);
    
    // Also ensure it doesn't exceed the clip duration
    if (selectedClip) {
      const maxEndTime = selectedClip.startTime + (selectedClip.duration || selectedClip.endTime - selectedClip.startTime);
      setClippingEndTime(Math.min(newEndTime, maxEndTime));
      
      // Update video time to follow clipping window
      if (videoRef.current) {
        const relativeTime = newEndTime - selectedClip.startTime;
        if (relativeTime >= 0 && relativeTime <= (selectedClip.duration || maxEndTime - selectedClip.startTime)) {
          videoRef.current.currentTime = relativeTime;
        }
      }
    } else {
      setClippingEndTime(newEndTime);
    }
  }, [isClippingMode, clippingStartTime, selectedClip]);

  // Handle timeline click during clipping mode
  const handleTimelineClickClipping = useCallback((time) => {
    if (!isClippingMode) return;
    
    setClippingEndTime(time);
    
    // Update video time to follow clipping window
    if (videoRef.current && selectedClip) {
      const relativeTime = time - selectedClip.startTime;
      if (relativeTime >= 0 && relativeTime <= selectedClip.duration) {
        videoRef.current.currentTime = relativeTime;
      }
    }
  }, [isClippingMode, selectedClip]);

  // Export function
  const handleExport = useCallback(async () => {
    if (typeof window.electronAPI?.exportVideo !== 'function') return;
    
      setIsExporting(true);
      setExportProgress(0);

    try {
      await window.electronAPI.exportVideo(clips.filter(clip => clip.onTimeline));
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [clips]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedClip) {
        deleteClip(selectedClip.id);
        setSelectedClip(null);
      } else if (e.key === 's' && selectedClip) {
        splitClip(selectedClip.id, currentTime);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip, currentTime, deleteClip, splitClip]);

  // Playback control
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="app" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Professional Header */}
      <div className="app-header">
        <div className="header-left">
          <button className="logo-button" onClick={toggleSidebar}>
            <div className="logo-icon">CF</div>
            <h1>ClipForge</h1>
          </button>
        </div>
        
        <div className="header-center">
          <div className="nav-tabs">
            <button className="nav-tab active">Edit</button>
            <button className="nav-tab">Cut</button>
            <button className="nav-tab">Audio</button>
            <button className="nav-tab">Text</button>
            <button className="nav-tab">Effects</button>
          </div>
        </div>
        
        <div className="header-right">
          <div className="project-info">
            <div className="project-name">Untitled Project</div>
            <div className="project-path">~/Desktop/ClipForge</div>
          </div>
        </div>
      </div>
      
      {/* Main Workspace */}
      <div className="workspace">
        {/* CapCut-style Left Sidebar */}
        {showSidebar && (
        <div className="capcut-sidebar">
          <div className="sidebar-nav">
            <button className="sidebar-nav-item active" onClick={toggleMediaLibrary}>
              <div className="nav-icon">☁️</div>
              <div className="nav-label">Media</div>
            </button>
            <button className="sidebar-nav-item">
              <div className="nav-icon">🎬</div>
              <div className="nav-label">Stock</div>
            </button>
            <button className="sidebar-nav-item">
              <div className="nav-icon">🖼️</div>
              <div className="nav-label">Photos</div>
            </button>
            <button className="sidebar-nav-item">
              <div className="nav-icon">🎵</div>
              <div className="nav-label">Audio</div>
            </button>
            <button className="sidebar-nav-item">
              <div className="nav-icon">T</div>
              <div className="nav-label">Text</div>
            </button>
            <button className="sidebar-nav-item">
              <div className="nav-icon">💬</div>
              <div className="nav-label">Captions</div>
            </button>
          </div>
        </div>
        )}
        
        {/* Media Library Panel */}
        {showSidebar && showMediaLibrary && (
          <div className="capcut-left-panel">
            <div className="panel-header">
              <h3>Media Library</h3>
            </div>
            <div className="panel-content">
              <div className="action-buttons">
                <button className="upload-btn" onClick={() => setShowImporter(true)}>
                  <span className="upload-icon">📤</span>
                  Upload
                </button>
                <div className="record-section">
                  <button className="record-btn" onClick={handleScreenCaptureClick}>
                    <span className="record-icon">🖼️</span>
                    <span className="record-text">Record</span>
                  </button>
                </div>
              </div>
              
              <div className="media-library">
                {clips.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎬</div>
                    <p>No media files</p>
                    <p className="empty-subtitle">Import videos or record new content</p>
                  </div>
                ) : (
                  <div className="media-grid">
                    {clips.map(clip => (
                      <div 
                        key={clip.id} 
                        className={`media-item ${selectedClip?.id === clip.id ? 'selected' : ''}`}
                        onClick={() => setSelectedClip(clip)}
                      >
                        <div className="media-thumbnail">
                          <div className="thumbnail-placeholder">
                            <span className="placeholder-icon">🎬</span>
                          </div>
                          <div className="play-overlay">
                            <span className="play-icon">▶️</span>
                          </div>
                          <div className="duration-badge">
                            {formatTime(clip.duration)}
                          </div>
                          <button 
                            className="media-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteClip(clip.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div className="metadata-overlay">
                          <div className="filename">{clip.name}</div>
                          <div className="resolution">1920×1080</div>
                          <div className="file-size">25.6 MB</div>
                          <div className="clip-actions">
                            {!clip.onTimeline ? (
                              <button 
                                className="btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addClipToTimeline(clip.id, 0, 0);
                                }}
                              >
                                Add to Timeline
                              </button>
                            ) : (
                              <button 
                                className="btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeClipFromTimeline(clip.id);
                                }}
                              >
                                Remove from Timeline
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Center Panel */}
        <div className="capcut-center-panel">
          {/* Video Preview */}
          <div className="video-preview-panel">
            <div className="video-container">
              {selectedClip ? (
                <div className="custom-video-player">
                  <video 
            ref={videoRef}
                    className="preview-video"
                    src={selectedClip.url}
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <div className="video-overlay">
                    <button 
                      className="play-button"
                      onClick={() => {
                        if (videoRef.current) {
                          if (isPlaying) {
                            videoRef.current.pause();
                          } else {
                            videoRef.current.play();
                          }
                        }
                      }}
                    >
                      {isPlaying ? '⏸️' : '▶️'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-video">
                  <div className="no-video-icon">🎬</div>
                  <h2>No Video Loaded</h2>
                  <p>Import a video file or add clips to the timeline to see the preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline - Full Width Bottom */}
      <Timeline 
        clips={clips.filter(clip => clip.onTimeline)}
        currentTime={currentTime}
        onTimeChange={setCurrentTime}
        onClipUpdate={setClips}
        zoom={timelineZoom}
        onZoomChange={setTimelineZoom}
        selectedClip={selectedClip}
        onClipSelect={setSelectedClip}
        onDeleteClip={deleteClip}
        onSplitClip={splitClip}
        onDragFromSidebar={handleDragFromSidebar}
        isPlaying={isPlaying}
        onPlayPause={() => {
          if (videoRef.current) {
            if (isPlaying) {
              videoRef.current.pause();
            } else {
              videoRef.current.play();
            }
          }
        }}
        // Clipping props
        isClippingMode={isClippingMode}
        clippingStartTime={clippingStartTime}
        clippingEndTime={clippingEndTime}
        onStartClipping={startClipping}
        onEndClipping={endClipping}
        onCancelClipping={cancelClipping}
        onUpdateClippingWindow={updateClippingWindow}
        onTimelineClickClipping={handleTimelineClickClipping}
        isDraggingClippingWindow={isDraggingClippingWindow}
        onSetDraggingClippingWindow={setIsDraggingClippingWindow}
      />

      {showImporter && (
        <VideoImporter 
          onClose={() => setShowImporter(false)}
          onImport={handleVideoImport}
        />
      )}

      {showMediaCapture && (
        <MediaCapture 
          captureType={captureType}
          onClose={() => setShowMediaCapture(false)}
          onCapture={handleMediaCapture}
        />
      )}
    </div>
  );
}

export default App;