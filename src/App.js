import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
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
  const [showImporter, setShowImporter] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [captureType, setCaptureType] = useState(CAPTURE_TYPES.SCREEN);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

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
    
    video.onloadedmetadata = () => {
      newClip.duration = video.duration;
      newClip.endTime = video.duration;
      setClips(prev => [...prev, newClip]);
    };
    
    video.onerror = () => URL.revokeObjectURL(newClip.url);
  }, [createClip]);

  // Handle media capture
  const handleMediaCapture = useCallback((file) => {
    if (!file) return;
    
    const clipType = captureType === CAPTURE_TYPES.SCREEN ? CLIP_TYPES.SCREEN_CAPTURE : CLIP_TYPES.WEBCAM_CAPTURE;
    const name = `${captureType === CAPTURE_TYPES.SCREEN ? 'Screen' : 'Webcam'} Recording ${new Date().toLocaleTimeString()}`;
    
    const newClip = createClip(file, clipType, name);
    const video = document.createElement('video');
    video.src = newClip.url;
    
    video.onloadedmetadata = () => {
      newClip.duration = video.duration;
      newClip.endTime = video.duration;
      setClips(prev => [...prev, newClip]);
    };
    
    video.onerror = () => URL.revokeObjectURL(newClip.url);
  }, [captureType, createClip]);

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
    setClips(prev => prev.map(clip => 
      clip.id === clipId 
        ? { ...clip, onTimeline: true, track: trackId, startTime, position: startTime }
        : clip
    ));
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

  return (
    <div className="app" onDrop={handleDrop} onDragOver={handleDragOver}>
      <Header 
        onImportClick={() => setShowImporter(true)}
        onExportClick={handleExport}
        onScreenCaptureClick={handleScreenCaptureClick}
        onWebcamClick={handleWebcamClick}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onToggleSidebar={toggleSidebar}
        showSidebar={showSidebar}
      />
      
      <div className="main-content">
        {showSidebar && (
          <Sidebar 
            clips={clips}
            selectedClip={selectedClip}
            onClipSelect={setSelectedClip}
            onAddToTimeline={addClipToTimeline}
            onRemoveFromTimeline={removeClipFromTimeline}
            onDeleteClip={deleteClip}
            onDragFromSidebar={handleDragFromSidebar}
          />
        )}
        
        <div className={`editor-area ${!showSidebar ? 'full-width' : ''}`}>
          <Preview 
            clips={clips.filter(clip => clip.onTimeline)}
            currentTime={currentTime}
            isPlaying={isPlaying}
            videoRef={videoRef}
          />
          
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
          />
        </div>
      </div>

      {showImporter && (
        <VideoImporter 
          onClose={() => setShowImporter(false)}
          onImport={handleVideoImport}
        />
      )}

      {showMediaCapture && (
        <MediaCapture 
          type={captureType}
          onClose={() => setShowMediaCapture(false)}
          onCapture={handleMediaCapture}
        />
      )}
    </div>
  );
}

export default App;