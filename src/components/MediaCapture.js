import React, { useState, useRef, useEffect } from 'react';

const MediaCapture = ({ captureType: propCaptureType, onCapture, onClose }) => {
  const [captureType, setCaptureType] = useState(propCaptureType || 'screen'); // 'screen' or 'webcam'
  const [screenSources, setScreenSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Update capture type when prop changes
    if (propCaptureType) {
      setCaptureType(propCaptureType);
    }
  }, [propCaptureType]);

  useEffect(() => {
    loadScreenSources();

    // Listen for recording control actions from floating window
    const handleRecordingControlAction = (action) => {
      console.log('Received recording control action:', action);
      if (action.type === 'stop') {
        stopRecording();
      } else if (action.type === 'pause') {
        // Pause functionality can be added later if needed
        console.log('Pause state:', action.isPaused);
      }
    };

    window.electronAPI.onRecordingControlAction(handleRecordingControlAction);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Close recording control window if open
      window.electronAPI.closeRecordingControl();
      // Close recording overlay if open
      window.electronAPI.closeRecordingOverlay();
    };
  }, []);

  const loadScreenSources = async () => {
    try {
      // First, check what media devices are available
      if (navigator.mediaDevices) {
        console.log('navigator.mediaDevices is available');
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          console.log('Available media devices:', devices);
        } catch (e) {
          console.error('Error enumerating devices:', e);
        }
      } else {
        console.error('navigator.mediaDevices is NOT available!');
      }

      const sources = await window.electronAPI.getScreenSources();
      console.log('Loaded screen sources:', sources);
      console.log('Number of sources:', sources.length);

      if (sources.length > 0) {
        sources.forEach((source, index) => {
          console.log(`Source ${index}:`, {
            id: source.id,
            name: source.name,
            display_id: source.display_id
          });
        });
      } else {
        console.warn('No screen sources available! This might indicate a permission issue.');
      }

      setScreenSources(sources);
      if (sources.length > 0) {
        setSelectedSource(sources[0]);
        console.log('Selected default source:', sources[0]);
      }
    } catch (error) {
      console.error('Error loading screen sources:', error);
    }
  };

  const startRecording = async () => {
    try {
      let stream = null;

      if (captureType === 'screen') {
        if (!selectedSource) {
          alert('Please select a screen source');
          return;
        }

        console.log('Starting screen recording with source:', selectedSource);
        console.log('Source ID:', selectedSource.id);
        console.log('Source name:', selectedSource.name);

        // Try multiple approaches for screen capture
        let lastError = null;

        // Approach 1: Try Electron-specific getUserMedia with various constraint formats
        const constraintFormats = [
          // Format 1: Modern format (Electron 13+) with audio
          {
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id
              }
            }
          },
          // Format 2: Alternative mandatory format with max dimensions and audio
          {
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id,
                maxSampleRate: 48000
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id,
                maxWidth: 4000,
                maxHeight: 4000,
                maxFrameRate: 30
              }
            }
          },
          // Format 3: With min/max dimensions and audio
          {
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id,
                minWidth: 640,
                maxWidth: 4000,
                minHeight: 480,
                maxHeight: 4000
              }
            }
          },
          // Format 4: Fallback without audio if audio capture fails
          {
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedSource.id
              }
            }
          }
        ];

        for (let i = 0; i < constraintFormats.length; i++) {
          const constraints = constraintFormats[i];
          console.log(`Trying getUserMedia format ${i + 1}:`, JSON.stringify(constraints, null, 2));

          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log(`Success with getUserMedia format ${i + 1}!`);
            break;
          } catch (error) {
            console.error(`getUserMedia format ${i + 1} failed:`, error.name, error.message, error);
            lastError = error;

            // If this is a permission error, don't try other formats
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
              throw new Error('Screen recording permission denied. Please:\n1. Open System Preferences > Privacy & Security > Screen Recording\n2. Enable permission for Electron\n3. Restart the application');
            }
          }
        }

        // Approach 2: If all getUserMedia attempts failed, try getDisplayMedia (standard API)
        if (!stream) {
          console.log('All getUserMedia formats failed, trying getDisplayMedia...');
          try {
            if (navigator.mediaDevices.getDisplayMedia) {
              // Try with audio first
              try {
                stream = await navigator.mediaDevices.getDisplayMedia({
                  video: {
                    displaySurface: 'monitor',
                    cursor: 'always'
                  },
                  audio: true
                });
                console.log('Success with getDisplayMedia (with audio)!');
              } catch (audioError) {
                console.log('getDisplayMedia with audio failed, trying without audio:', audioError.message);
                stream = await navigator.mediaDevices.getDisplayMedia({
                  video: {
                    displaySurface: 'monitor',
                    cursor: 'always'
                  },
                  audio: false
                });
                console.log('Success with getDisplayMedia (without audio)!');
              }
            }
          } catch (error) {
            console.error('getDisplayMedia failed:', error.name, error.message);
            lastError = error;
          }
        }

        if (!stream) {
          console.error('All screen capture methods failed. Last error:', lastError);
          const errorDetails = lastError ? `${lastError.name}: ${lastError.message}` : 'Unknown error';
          throw new Error(`Could not start screen recording.\n\nError: ${errorDetails}\n\nPlease try:\n1. Selecting a different screen/window\n2. Restarting the application\n3. Checking Screen Recording permission in System Preferences`);
        }

        console.log('Screen stream obtained successfully');
        console.log('Video tracks:', stream.getVideoTracks());

        // Verify we got a screen stream
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          console.log('Video track label:', videoTrack.label);
          const settings = videoTrack.getSettings();
          console.log('Video track settings:', settings);
          console.log('Display surface:', settings.displaySurface);
        }
      } else {
        // Webcam recording
        console.log('Starting webcam recording');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        console.log('Webcam stream obtained:', stream);
      }

      // Validate stream before proceeding
      if (!stream || !(stream instanceof MediaStream)) {
        throw new Error('Invalid MediaStream received. Please try selecting a different screen source.');
      }

      // Check if stream has video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found in the stream. Please try selecting a different screen source.');
      }

      console.log('Stream validation passed:', {
        isMediaStream: stream instanceof MediaStream,
        active: stream.active,
        videoTracks: videoTracks.length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackLabel: videoTracks[0]?.label
      });

      streamRef.current = stream;
      
      // Display the stream in video element for live preview
      if (videoRef.current) {
        try {
          // Check if srcObject is supported
          if ('srcObject' in videoRef.current) {
            videoRef.current.srcObject = stream;
          } else {
            // Fallback for older browsers
            videoRef.current.src = URL.createObjectURL(stream);
          }
          
          // Ensure video is visible and playing for live preview
          videoRef.current.style.display = 'block';
          videoRef.current.muted = true; // Mute to prevent feedback
          videoRef.current.loop = false;
          
          videoRef.current.play().catch(err => {
            console.log('Video autoplay prevented:', err);
            // Try to play after user interaction
            videoRef.current.addEventListener('click', () => {
              videoRef.current.play().catch(e => console.log('Manual play failed:', e));
            });
          });
          
          console.log('Live preview set up for', captureType === 'screen' ? 'screen recording' : 'webcam recording');
        } catch (error) {
          console.error('Error setting video srcObject:', error);
          // Try alternative approach
          try {
            videoRef.current.src = URL.createObjectURL(stream);
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }
      }

      // Set up MediaRecorder with best available codec
      // Try H.264 first for better compatibility, then VP9, then VP8
      let mimeType = 'video/webm;codecs=h264';
      let fileExtension = 'webm';

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('H.264 not supported, trying VP9');
        mimeType = 'video/webm;codecs=vp9';
      }

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('VP9 not supported, trying VP8');
        mimeType = 'video/webm;codecs=vp8';
      }

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('VP8 not supported, using default webm');
        mimeType = 'video/webm';
      }

      console.log('Using mimeType:', mimeType);

      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
        });
        console.log('MediaRecorder created successfully');
      } catch (error) {
        console.error('Failed to create MediaRecorder:', error);
        throw new Error(`Failed to create MediaRecorder: ${error.message}. Please try a different screen source or restart the application.`);
      }

      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('Data chunk received, size:', event.data.size);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped, processing', chunks.length, 'chunks');
        setIsProcessing(true);
        setIsRecording(false);

        const blob = new Blob(chunks, { type: mimeType });
        console.log('Created blob, size:', blob.size, 'type:', blob.type);

        // Create a file-like object for the captured video
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${captureType}-capture-${timestamp}.${fileExtension}`;
        const file = new File([blob], fileName, {
          type: mimeType
        });

        console.log('Created file:', fileName, 'size:', file.size);

        // Close the floating window
        window.electronAPI.closeRecordingControl();

        // Close the red outline overlay
        window.electronAPI.closeRecordingOverlay();

        // Add the captured video to the library and close modal
        setTimeout(() => {
          onCapture(file);
          setIsProcessing(false);
          onClose();
        }, 500);
      };

      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording
      recorder.start(1000); // Collect data every second

      // Start timer and update floating window
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Update floating window time
          window.electronAPI.updateRecordingTime(newTime);
          return newTime;
        });
      }, 1000);

      // Show floating recording control window
      await window.electronAPI.showRecordingControl();

      // Show red outline overlay on the screen being recorded
      if (captureType === 'screen' && selectedSource?.display_id) {
        try {
          await window.electronAPI.showRecordingOverlay(selectedSource.display_id);
        } catch (error) {
          console.warn('Could not show recording overlay:', error);
          // Continue recording even if overlay fails
        }
      } else if (captureType === 'screen') {
        // If no display_id, show overlay on primary display
        try {
          await window.electronAPI.showRecordingOverlay(null);
        } catch (error) {
          console.warn('Could not show recording overlay:', error);
        }
      }

      // Modal will hide automatically due to isRecording state change
      // Recording continues in the background

    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to start recording: ${errorMessage}`);
      setIsRecording(false);
      
      // Clean up stream if it was created
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording...');

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Close the floating control window
    window.electronAPI.closeRecordingControl();

    // Close the red outline overlay
    window.electronAPI.closeRecordingOverlay();

    setIsRecording(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: isRecording ? 'none' : 'flex', // Hide modal when recording
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#2a2a2a',
          padding: '30px',
          borderRadius: '12px',
          border: '1px solid #444444',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', textAlign: 'center' }}>
          {captureType === 'screen' ? '🎥 Screen Capture' : '📹 Webcam Recording'}
        </h3>

        {/* Capture Type Selection */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className={`btn ${captureType === 'screen' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (!isRecording) {
                  setCaptureType('screen');
                  // Reload sources when switching to screen
                  loadScreenSources();
                  // Clear video preview
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                  }
                }
              }}
              disabled={isRecording}
            >
              🖥️ Screen
            </button>
            <button
              className={`btn ${captureType === 'webcam' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (!isRecording) {
                  setCaptureType('webcam');
                  // Clear video preview
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                  }
                }
              }}
              disabled={isRecording}
            >
              📹 Webcam
            </button>
          </div>
        </div>

        {/* Screen Source Selection */}
        {captureType === 'screen' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Select Screen/Window:
            </label>
            <select
              value={selectedSource?.id || ''}
              onChange={(e) => {
                const source = screenSources.find(s => s.id === e.target.value);
                setSelectedSource(source);
              }}
              disabled={isRecording}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white'
              }}
            >
              {screenSources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.id.includes('window') ? 'Window' : 'Screen'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Preview */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: '#fff' }}>
            {isRecording ? '🔴 Recording Preview' : 'Live Preview'}
          </h4>
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              maxWidth: '640px',
              height: 'auto',
              backgroundColor: '#000',
              borderRadius: '8px',
              border: isRecording ? '3px solid #ff4444' : '2px solid #333',
              display: isRecording ? 'block' : 'none'
            }}
          />
          {!isRecording && (
            <div style={{
              width: '100%',
              maxWidth: '640px',
              height: '360px',
              backgroundColor: '#222',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '16px',
              border: '2px solid #333'
            }}>
              Preview will appear when recording starts
            </div>
          )}
        </div>

        {/* Recording Controls */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isRecording && (
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: '#ff4444',
              marginBottom: '10px'
            }}>
              🔴 Recording: {formatTime(recordingTime)}
            </div>
          )}
          
          {isProcessing && (
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#4CAF50',
              marginBottom: '10px'
            }}>
              ✅ Processing recording...
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {!isRecording && !isProcessing ? (
              <button 
                className="btn btn-primary"
                onClick={startRecording}
                disabled={captureType === 'screen' && !selectedSource}
              >
                ▶️ Start Recording
              </button>
            ) : isRecording ? (
              <button 
                className="btn btn-danger"
                onClick={stopRecording}
              >
                ⏹️ Stop Recording
              </button>
            ) : null}
            
            <button 
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isRecording}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ 
          fontSize: '12px', 
          color: '#888888',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          {captureType === 'screen' 
            ? 'Select a screen or window to record. The recording will be added to your timeline.'
            : 'Your webcam will be used for recording. Make sure to allow camera access when prompted.'
          }
        </div>
      </div>
    </div>
  );
};

export default MediaCapture;
