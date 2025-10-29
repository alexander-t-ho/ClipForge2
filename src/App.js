import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
import VideoImporter from './components/VideoImporter';
import MediaCapture from './components/MediaCapture';

function App() {
  const [clips, setClips] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [showImporter, setShowImporter] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [captureType, setCaptureType] = useState('screen'); // 'screen' or 'webcam'
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true); // Track sidebar visibility

  const videoRef = useRef(null);

  // Handle video import
  const handleVideoImport = (file) => {
    const newClip = {
      id: Date.now(),
      name: file.name,
      file: file,
      url: URL.createObjectURL(file),
      duration: 0,
      startTime: 0,
      endTime: 0,
      position: 0, // Don't auto-position on timeline
      track: -1, // -1 means not on timeline
      type: 'imported', // Track the source type
      onTimeline: false // Track if it's on timeline
    };

    // Get video duration
    const video = document.createElement('video');
    video.src = newClip.url;
    video.onloadedmetadata = () => {
      newClip.duration = video.duration;
      newClip.endTime = video.duration;
      setClips(prev => [...prev, newClip]);
    };
  };

  // Handle media capture (screen/webcam)
  const handleMediaCapture = (file) => {
    const newClip = {
      id: Date.now(),
      name: file.name,
      file: file,
      url: URL.createObjectURL(file),
      duration: 0,
      startTime: 0,
      endTime: 0,
      position: 0, // Don't auto-position on timeline
      track: -1, // -1 means not on timeline
      type: captureType, // Track the capture type
      onTimeline: false // Track if it's on timeline
    };

    // Get video duration
    const video = document.createElement('video');
    video.src = newClip.url;
    video.onloadedmetadata = () => {
      newClip.duration = video.duration;
      newClip.endTime = video.duration;
      setClips(prev => [...prev, newClip]);
    };
  };

  // Handle screen capture click
  const handleScreenCaptureClick = () => {
    setCaptureType('screen');
    setShowMediaCapture(true);
  };

  // Handle webcam click
  const handleWebcamClick = () => {
    setCaptureType('webcam');
    setShowMediaCapture(true);
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        handleVideoImport(file);
      }
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Playback controls
  const playPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Add clip to timeline with smart positioning
  const addClipToTimeline = (clipId, startTime = null, track = 0) => {
    setClips(prev => {
      const clipToAdd = prev.find(clip => clip.id === clipId);
      if (!clipToAdd) return prev;

      // If no startTime specified, find next available position
      let finalStartTime = startTime;
      if (finalStartTime === null) {
        const trackClips = prev.filter(clip => clip.track === track && clip.onTimeline);
        
        if (trackClips.length === 0) {
          finalStartTime = 0; // First clip starts at 0
        } else {
          // Sort clips by start time
          const sortedClips = trackClips.sort((a, b) => a.startTime - b.startTime);
          
          // Check if there's space at the beginning
          if (sortedClips[0].startTime >= clipToAdd.duration) {
            finalStartTime = 0;
          } else {
            // Check for gaps between clips
            let foundGap = false;
            for (let i = 0; i < sortedClips.length - 1; i++) {
              const currentClip = sortedClips[i];
              const nextClip = sortedClips[i + 1];
              const gap = nextClip.startTime - currentClip.endTime;
              
              if (gap >= clipToAdd.duration) {
                finalStartTime = currentClip.endTime;
                foundGap = true;
                break;
              }
            }
            
            // If no gap found, place after the last clip
            if (!foundGap) {
              const lastClip = sortedClips[sortedClips.length - 1];
              finalStartTime = lastClip.endTime;
            }
          }
        }
      }

      return prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            onTimeline: true,
            track: track,
            position: finalStartTime,
            startTime: finalStartTime,
            endTime: finalStartTime + clip.duration
          };
        }
        return clip;
      });
    });
  };

  // Handle drag from sidebar to timeline
  const handleDragFromSidebar = (startTime, track) => {
    if (selectedClip && !selectedClip.onTimeline) {
      addClipToTimeline(selectedClip.id, startTime, track);
    }
  };

  // Split clip at playhead position
  const splitClip = (clipId, splitTime) => {
    setClips(prev => {
      const clipToSplit = prev.find(clip => clip.id === clipId);
      if (!clipToSplit || splitTime <= clipToSplit.startTime || splitTime >= clipToSplit.endTime) {
        return prev;
      }

      // Create two clips from the original
      const firstClip = {
        ...clipToSplit,
        endTime: splitTime,
        name: `${clipToSplit.name} (Part 1)`
      };
      
      const secondClip = {
        ...clipToSplit,
        id: Date.now(), // New ID for second clip
        name: `${clipToSplit.name} (Part 2)`,
        startTime: splitTime,
        url: clipToSplit.url // Same video source
      };
      
      // Replace original clip with both parts
      return prev.map(clip => 
        clip.id === clipId ? [firstClip, secondClip] : clip
      ).flat();
    });
  };

  // Remove clip from timeline
  const removeClipFromTimeline = (clipId) => {
    setClips(prev => prev.map(clip => {
      if (clip.id === clipId) {
        return {
          ...clip,
          onTimeline: false,
          track: -1,
          position: 0
        };
      }
      return clip;
    }));
  };

  // Delete clip completely
  const deleteClip = (clipId) => {
    setClips(prev => prev.filter(clip => clip.id !== clipId));
    if (selectedClip?.id === clipId) {
      setSelectedClip(null);
    }
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedClip) {
        deleteClip(selectedClip.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip]);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Export functionality
  const handleExport = async () => {
    if (clips.length === 0) {
      alert('No clips to export');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      // Set up progress listener
      window.electronAPI.onExportProgress((progress) => {
        setExportProgress(progress.percent || 0);
      });

      // For now, export the first clip as a simple example
      // In a full implementation, you'd combine all clips
      const firstClip = clips[0];
      
      // Get output path from user
      const outputPath = await window.electronAPI.saveFileDialog('exported-video.mp4');
      if (!outputPath) {
        setIsExporting(false);
        return;
      }

      // Process the video
      const result = await window.electronAPI.processVideo(
        firstClip.file.path || firstClip.url,
        outputPath,
        {
          startTime: firstClip.startTime,
          duration: firstClip.endTime - firstClip.startTime,
          resolution: '1920x1080'
        }
      );

      if (result.success) {
        alert(`Video exported successfully to: ${result.outputPath}`);
      }

    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      window.electronAPI.removeExportProgressListener();
    }
  };

  return (
    <div 
      className="app" 
      onDrop={handleDrop} 
      onDragOver={handleDragOver}
    >
      <Header 
        onImportClick={() => setShowImporter(true)}
        onExportClick={handleExport}
        onScreenCaptureClick={handleScreenCaptureClick}
        onWebcamClick={handleWebcamClick}
        isPlaying={isPlaying}
        onPlayPause={playPause}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onToggleSidebar={toggleSidebar}
        showSidebar={showSidebar}
      />
      
      <div className="main-content">
        {showSidebar && (
          <Sidebar 
            clips={clips}
            onClipSelect={setSelectedClip}
            selectedClip={selectedClip}
            onAddToTimeline={addClipToTimeline}
            onRemoveFromTimeline={removeClipFromTimeline}
            onDeleteClip={deleteClip}
          />
        )}
        
        <div className={`editor-area ${!showSidebar ? 'full-width' : ''}`}>
          <Preview 
            ref={videoRef}
            clips={clips}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onPlayStateChange={setIsPlaying}
          />
          
          <Timeline 
            clips={clips.filter(clip => clip.onTimeline)}
            currentTime={currentTime}
            onTimeChange={seekTo}
            onClipUpdate={setClips}
            zoom={timelineZoom}
            onZoomChange={setTimelineZoom}
            selectedClip={selectedClip}
            onClipSelect={setSelectedClip}
            onDeleteClip={deleteClip}
            onSplitClip={splitClip}
            onDragFromSidebar={handleDragFromSidebar}
          />
        </div>
      </div>

      {showImporter && (
        <VideoImporter 
          onImport={handleVideoImport}
          onClose={() => setShowImporter(false)}
        />
      )}

      {showMediaCapture && (
        <MediaCapture 
          onCapture={handleMediaCapture}
          onClose={() => setShowMediaCapture(false)}
        />
      )}
    </div>
  );
}

export default App;
