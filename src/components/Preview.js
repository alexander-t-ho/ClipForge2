import React, { forwardRef, useEffect, useState } from 'react';

const Preview = forwardRef(({ clips, currentTime, onTimeUpdate, onPlayStateChange }, ref) => {
  const [currentClip, setCurrentClip] = useState(null);

  useEffect(() => {
    // Find the clip that should be playing at current time
    const activeClip = clips.find(clip => 
      currentTime >= clip.startTime && currentTime <= clip.endTime
    );
    setCurrentClip(activeClip);
  }, [clips, currentTime]);

  const handleTimeUpdate = (e) => {
    onTimeUpdate(e.target.currentTime);
  };

  const handlePlay = () => {
    onPlayStateChange(true);
  };

  const handlePause = () => {
    onPlayStateChange(false);
  };

  return (
    <div className="preview">
      {currentClip ? (
        <video
          ref={ref}
          className="preview-video"
          src={currentClip.url}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          controls={false}
        />
      ) : (
        <div className="preview-placeholder">
          {clips.length === 0 ? (
            <>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎬</div>
              <div>Import videos to start editing</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Drag & drop files or use the Import button
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏸️</div>
              <div>No clip at current time</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Move the playhead or add clips to the timeline
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

Preview.displayName = 'Preview';

export default Preview;
