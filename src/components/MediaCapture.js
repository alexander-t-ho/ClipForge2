import React, { useState, useRef, useEffect } from 'react';

const MediaCapture = ({ onCapture, onClose }) => {
  const [captureType, setCaptureType] = useState('screen'); // 'screen' or 'webcam'
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
    loadScreenSources();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const loadScreenSources = async () => {
    try {
      const sources = await window.electronAPI.getScreenSources();
      setScreenSources(sources);
      if (sources.length > 0) {
        setSelectedSource(sources[0]);
      }
    } catch (error) {
      console.error('Error loading screen sources:', error);
    }
  };

  const startRecording = async () => {
    try {
      let stream;
      
      if (captureType === 'screen') {
        if (!selectedSource) {
          alert('Please select a screen source');
          return;
        }
        stream = await window.electronAPI.startScreenRecording(selectedSource.id);
      } else {
        stream = await window.electronAPI.startWebcamRecording({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
      }

      streamRef.current = stream;
      
      // Display the stream in video element
      if (videoRef.current) {
        try {
          // Check if srcObject is supported
          if ('srcObject' in videoRef.current) {
            videoRef.current.srcObject = stream;
          } else {
            // Fallback for older browsers
            videoRef.current.src = URL.createObjectURL(stream);
          }
          videoRef.current.play().catch(err => {
            console.log('Video autoplay prevented:', err);
          });
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

      // Set up MediaRecorder with fallback options
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });

      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

        recorder.onstop = () => {
        setIsProcessing(true);
        const blob = new Blob(chunks, { type: 'video/webm' });
        
        // Create a file-like object for the captured video
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `${captureType}-capture-${timestamp}.webm`, {
          type: 'video/webm'
        });
        
        // Show success message briefly before closing
        setTimeout(() => {
          onCapture(file);
          onClose();
        }, 1500);
      };

      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording
      recorder.start(1000); // Collect data every second

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording: ' + error.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
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
        display: 'flex',
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
              onClick={() => setCaptureType('screen')}
              disabled={isRecording}
            >
              🖥️ Screen
            </button>
            <button
              className={`btn ${captureType === 'webcam' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCaptureType('webcam')}
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

        {/* Preview */}
        <div style={{ marginBottom: '20px' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              maxHeight: '300px',
              backgroundColor: '#1a1a1a',
              borderRadius: '8px',
              border: '1px solid #444'
            }}
          />
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
