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
    if (!file?.type.startsWith('video/')) {
      console.warn('File is not a video:', file?.type);
      return;
    }
    
    // Validate file size
    if (file.size === 0) {
      console.warn('Video file is empty');
      return;
    }
    
    // Check for supported video formats
    const supportedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
    if (!supportedTypes.includes(file.type)) {
      console.warn('Video format may not be supported:', file.type);
    }
    
    const newClip = createClip(file, CLIP_TYPES.IMPORTED);
    const video = document.createElement('video');
    video.src = newClip.url;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous'; // Try to avoid CORS issues
    
    video.onloadedmetadata = () => {
      console.log('Video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        fileType: file.type,
        fileSize: file.size
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
      console.error('Video src:', video.src);
      console.error('Video error details:', {
        code: video.error?.code,
        message: video.error?.message,
        networkState: video.networkState,
        readyState: video.readyState
      });
      
      // Check if it's a format issue
      if (video.error?.code === 4) {
        console.warn('Video format not supported, trying to convert...');
        // For now, just add with default values
        newClip.duration = 10;
        newClip.endTime = 10;
        newClip.name = `${newClip.name} (Format Issue)`;
        setClips(prev => [...prev, newClip]);
      } else {
        // Clean up the invalid URL
        URL.revokeObjectURL(newClip.url);
        
        // Still add the clip with default values so user knows there was an issue
        newClip.duration = 10;
        newClip.endTime = 10;
        newClip.name = `${newClip.name} (Load Error)`;
        setClips(prev => [...prev, newClip]);
      }
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
      console.error('Captured video src:', video.src);
      console.error('Captured video error details:', {
        code: video.error?.code,
        message: video.error?.message,
        networkState: video.networkState,
        readyState: video.readyState
      });
      
      // Check if it's a format issue
      if (video.error?.code === 4) {
        console.warn('Captured video format not supported, trying to convert...');
        // For now, just add with default values
        newClip.duration = 10;
        newClip.endTime = 10;
        newClip.name = `${newClip.name} (Format Issue)`;
        setClips(prev => [...prev, newClip]);
      } else {
        // Clean up the invalid URL
        URL.revokeObjectURL(newClip.url);
        
        // Still add the clip with default values
        newClip.duration = 10;
        newClip.endTime = 10;
        newClip.name = `${newClip.name} (Load Error)`;
        setClips(prev => [...prev, newClip]);
      }
    };
  }, [createClip, captureType]);

  // Load test video on startup (optional)
  useEffect(() => {
    const loadTestVideo = async () => {
      try {
        const response = await fetch('/test-video.mp4');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const blob = await response.blob();
        
        // Validate the blob is actually a video
        if (blob.size === 0) {
          throw new Error('Empty video file');
        }
        
        const file = new File([blob], 'test-video.mp4', { type: 'video/mp4' });
        handleVideoImport(file);
      } catch (error) {
        console.log('Test video not available:', error.message);
        // Don't show error to user, just continue without test video
      }
    };
    
    // Skip test video loading for now to avoid 404 errors
    // if (process.env.NODE_ENV === 'development') {
    //   loadTestVideo();
    // }
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
    setClips(prev => {
      // Find the clip to add
      const clipToAdd = prev.find(clip => clip.id === clipId);
      if (!clipToAdd) return prev;

      // Calculate duration
      let duration = clipToAdd.duration;
      if (!duration || duration === 0) {
        duration = 10; // Default fallback
      }

      // Determine actual start time
      let actualStartTime = startTime;

      // If startTime is 0 or undefined (clicking "Add to Timeline" button)
      // Place the clip intelligently:
      // - If no clips on this track, start at 0:00
      // - Otherwise, place after the last clip on this track
      if (startTime === 0 || startTime === undefined) {
        const clipsOnTrack = prev.filter(c => c.onTimeline && c.track === trackId);

        if (clipsOnTrack.length === 0) {
          // No clips on this track, start at 0:00
          actualStartTime = 0;
        } else {
          // Find the last clip on this track and place the new clip after it
          const lastClip = clipsOnTrack.reduce((latest, clip) =>
            (!latest || clip.endTime > latest.endTime) ? clip : latest
          , null);
          actualStartTime = lastClip ? lastClip.endTime : 0;
        }
      }

      return prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            onTimeline: true,
            track: trackId,
            startTime: actualStartTime,
            endTime: actualStartTime + duration,
            position: actualStartTime
          };
        }
        return clip;
      });
    });
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

  // Find the current clip based on timeline position
  const getCurrentClip = useCallback(() => {
    const timelineClips = clips.filter(clip => clip.onTimeline);
    return timelineClips.find(clip => 
      currentTime >= clip.startTime && currentTime < clip.endTime
    );
  }, [clips, currentTime]);

  // Update video source and time when scrubbing timeline
  useEffect(() => {
    const currentClip = getCurrentClip();
    const video = videoRef.current;

    if (!video) return;

    if (currentClip) {
      // Check if we need to change the video source
      if (video.src !== currentClip.url) {
        video.src = currentClip.url;
        video.load();
      }

      // Set the video time to the relative position within the clip
      const relativeTime = currentTime - currentClip.startTime;
      if (relativeTime >= 0 && relativeTime <= currentClip.duration) {
        // Only update if the difference is significant (more than 0.1s)
        // This prevents fighting with the video's own timeupdate events
        if (Math.abs(video.currentTime - relativeTime) > 0.1) {
          video.currentTime = relativeTime;
        }
      }

      // If not playing, pause the video to show the frame
      if (!isPlaying && !video.paused) {
        video.pause();
      }
    } else {
      // No clip at current time, pause video
      if (!video.paused) {
        video.pause();
      }
    }
  }, [getCurrentClip, currentTime, isPlaying]);

  // Get next clip helper
  const getNextClip = useCallback((afterTime) => {
    const timelineClips = clips
      .filter(clip => clip.onTimeline)
      .sort((a, b) => a.startTime - b.startTime);

    return timelineClips.find(clip => clip.startTime >= afterTime);
  }, [clips]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      // When a clip ends, move to the next clip or stop
      const currentClip = getCurrentClip();
      if (currentClip) {
        const nextClip = getNextClip(currentClip.endTime);

        if (nextClip) {
          // Move to the start of the next clip and continue playing
          setCurrentTime(nextClip.startTime);
          video.src = nextClip.url;
          video.currentTime = 0;
          video.play().catch(err => console.log('Error playing next clip:', err));
        } else {
          // No more clips, stop playback
          setCurrentTime(currentClip.endTime);
          setIsPlaying(false);
        }
      }
    };

    const handleTimeUpdate = () => {
      // Update timeline position based on video playback
      const currentClip = getCurrentClip();
      if (currentClip && isPlaying) {
        const newTime = currentClip.startTime + video.currentTime;

        // Check if we've reached the end of the current clip
        if (newTime >= currentClip.endTime) {
          // Trigger move to next clip
          handleEnded();
        } else {
          setCurrentTime(newTime);
        }
      }
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [getCurrentClip, getNextClip, isPlaying]);

  // Playback control
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    
    if (!video) {
      console.warn('Video element not available');
      return;
    }
    
    if (isPlaying) {
      // Pause
      video.pause();
      setIsPlaying(false);
    } else {
      // Play
      const currentClip = getCurrentClip();
      if (currentClip) {
        // Set the correct video source and time before playing
        if (video.src !== currentClip.url) {
          video.src = currentClip.url;
          video.load();
        }
        
        const relativeTime = currentTime - currentClip.startTime;
        if (relativeTime >= 0 && relativeTime <= currentClip.duration) {
          video.currentTime = relativeTime;
        } else {
          video.currentTime = 0;
          setCurrentTime(currentClip.startTime);
        }
        
        video.play().catch(err => {
          console.error('Error playing video:', err);
          setIsPlaying(false);
        });
        setIsPlaying(true);
      } else {
        // No clip at current time, try to find first clip
        const timelineClips = clips.filter(clip => clip.onTimeline).sort((a, b) => a.startTime - b.startTime);
        if (timelineClips.length > 0) {
          const firstClip = timelineClips[0];
          setCurrentTime(firstClip.startTime);
          video.src = firstClip.url;
          video.currentTime = 0;
          video.load();
          video.play().catch(err => {
            console.error('Error playing first clip:', err);
            setIsPlaying(false);
          });
          setIsPlaying(true);
        }
      }
    }
  }, [isPlaying, getCurrentClip, currentTime, clips]);

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
                    onTimeUpdate={(e) => {
                      const currentClip = getCurrentClip();
                      if (currentClip) {
                        const newTime = currentClip.startTime + e.target.currentTime;
                        setCurrentTime(newTime);
                      }
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      const currentClip = getCurrentClip();
                      if (currentClip) {
                        const nextClip = clips.filter(clip => clip.onTimeline).find(clip => clip.startTime >= currentClip.endTime);
                        if (nextClip) {
                          setCurrentTime(nextClip.startTime);
                          videoRef.current.src = nextClip.url;
                          videoRef.current.currentTime = 0;
                          videoRef.current.play();
                        } else {
                          setIsPlaying(false);
                        }
                      }
                    }}
                  />
                  <div className="video-overlay">
                    <button 
                      className="play-button"
                      onClick={handlePlayPause}
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
        onPlayPause={handlePlayPause}
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