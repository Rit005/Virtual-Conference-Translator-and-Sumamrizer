import { useState, useEffect, useRef, useCallback } from 'react';
import { AUDIO_CONSTANTS, AUDIO_EVENTS } from '../utils/constants.js';
import websocketService from '../services/websocketService.js';
import toast from 'react-hot-toast';

/**
 * Custom React hook for real-time audio streaming using Web Audio API and MediaRecorder
 * Captures microphone audio and streams chunks every 1 second to Socket.IO backend
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.sessionId - Conference session ID
 * @param {string} options.language - Audio language (default: 'en')
 * @param {number} options.chunkDuration - Audio chunk duration in ms (default: 1000)
 * @param {Function} options.onChunkSent - Callback when chunk is successfully sent
 * @param {Function} options.onError - Error callback
 * @param {Function} options.onAudioLevel - Audio level callback for visualization
 * @returns {Object} Hook state and methods
 */
const useAudioStreaming = ({
  sessionId,
  language = 'en',
  chunkDuration = AUDIO_CONSTANTS.CHUNK_DURATION,
  onChunkSent,
  onError,
  onAudioLevel
}) => {
  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs for audio processing
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);

  // Check browser support
  const isSupported = useCallback(() => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.MediaRecorder &&
      window.AudioContext
    );
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    if (!isSupported()) {
      const unsupportedError = 'Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.';
      setError(unsupportedError);
      onError?.(unsupportedError);
      toast.error(unsupportedError);
      return false;
    }

    setIsRequestingPermission(true);
    setError(null);

    try {
      console.log('🎤 Requesting microphone access...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE,
          channelCount: AUDIO_CONSTANTS.CHANNELS
        }
      });

      // Setup audio analysis for level monitoring
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      // Store references
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      setHasPermission(true);
      setError(null);
      
      console.log('✅ Microphone access granted');
      toast.success('Microphone access granted');
      
      // Notify permission granted
      websocketService.emit(AUDIO_EVENTS.PERMISSION_GRANTED, { sessionId });
      
      return true;
    } catch (err) {
      console.error('❌ Microphone permission denied or error:', err);
      
      let errorMessage = 'Failed to access microphone. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please allow microphone access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Microphone is being used by another application.';
      } else {
        errorMessage += 'Please check your microphone settings and try again.';
      }

      setError(errorMessage);
      onError?.(errorMessage);
      toast.error(errorMessage);
      
      // Notify permission denied
      websocketService.emit(AUDIO_EVENTS.PERMISSION_DENIED, { 
        sessionId, 
        error: err.message 
      });
      
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isSupported, sessionId, onError]);

  // Setup MediaRecorder
  const setupMediaRecorder = useCallback(() => {
    if (!streamRef.current) {
      throw new Error('No audio stream available');
    }

    // Check for supported MIME type
    let mimeType = AUDIO_CONSTANTS.MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      // Fallback options
      const fallbackTypes = [
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav'
      ];
      
      mimeType = fallbackTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      console.log('Using fallback MIME type:', mimeType);
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: AUDIO_CONSTANTS.BIT_RATE
      });

      // Reset audio chunks
      audioChunksRef.current = [];

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop event
      mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        setIsRecording(false);
      };

      // Handle recording error
      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        const errorMessage = `Recording error: ${event.error.message}`;
        setError(errorMessage);
        onError?.(errorMessage);
        toast.error(errorMessage);
      };

      mediaRecorderRef.current = mediaRecorder;
      return mediaRecorder;
    } catch (err) {
      console.error('❌ Failed to setup MediaRecorder:', err);
      throw new Error(`Failed to setup audio recorder: ${err.message}`);
    }
  }, [onError]);

  // Send audio chunk to backend
  const sendAudioChunk = useCallback(async (audioBlob) => {
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('⚠️ Empty audio chunk, skipping...');
      return;
    }

    // Check chunk size limit
    if (audioBlob.size > AUDIO_CONSTANTS.CHUNK_SIZE_LIMIT) {
      console.warn('⚠️ Audio chunk too large, skipping...');
      return;
    }

    try {
      // Convert blob to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Send via WebSocket service
      websocketService.sendAudioChunk(sessionId, uint8Array, language);
      
      console.log(`📤 Sent audio chunk: ${audioBlob.size} bytes`);
      
      // Notify chunk sent
      onChunkSent?.({
        size: audioBlob.size,
        timestamp: Date.now(),
        sessionId
      });

    } catch (err) {
      console.error('❌ Failed to send audio chunk:', err);
      const errorMessage = `Failed to send audio: ${err.message}`;
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [sessionId, language, onChunkSent, onError]);

  // Update audio level for visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average amplitude
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 255, 1); // Normalize to 0-1 range
    
    setAudioLevel(normalizedLevel);
    onAudioLevel?.(normalizedLevel);
  }, [onAudioLevel]);

  // Start streaming audio
  const startStreaming = useCallback(async () => {
    if (isStreaming) {
      console.warn('⚠️ Already streaming');
      return;
    }

    try {
      // Request permission if not already granted
      if (!hasPermission) {
        const permissionGranted = await requestPermission();
        if (!permissionGranted) {
          return false;
        }
      }

      if (!sessionId) {
        throw new Error('Session ID is required for audio streaming');
      }

      console.log('🎬 Starting audio streaming...');
      
      // Setup MediaRecorder
      const mediaRecorder = setupMediaRecorder();
      
      // Start recording
      mediaRecorder.start(100); // Request data every 100ms
      setIsRecording(true);
      setIsStreaming(true);
      recordingStartTimeRef.current = Date.now();
      
      // Start audio level monitoring
      audioLevelIntervalRef.current = setInterval(updateAudioLevel, AUDIO_CONSTANTS.AUDIO_LEVEL_UPDATE_INTERVAL);
      
      // Setup chunk collection interval
      intervalRef.current = setInterval(() => {
        if (audioChunksRef.current.length > 0) {
          // Create blob from accumulated chunks
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType 
          });
          
          // Send chunk to backend
          sendAudioChunk(audioBlob);
          
          // Reset chunks for next interval
          audioChunksRef.current = [];
        }
      }, chunkDuration);

      // Update recording time
      const timeInterval = setInterval(() => {
        if (recordingStartTimeRef.current) {
          setRecordingTime(Date.now() - recordingStartTimeRef.current);
        }
      }, 1000);

      // Store interval reference for cleanup
      intervalRef.current.timeInterval = timeInterval;

      console.log('✅ Audio streaming started');
      toast.success('Audio streaming started');
      
      // Notify recording started
      websocketService.emit(AUDIO_EVENTS.RECORDING_STARTED, { 
        sessionId, 
        language,
        timestamp: Date.now()
      });

      return true;
    } catch (err) {
      console.error('❌ Failed to start streaming:', err);
      const errorMessage = `Failed to start streaming: ${err.message}`;
      setError(errorMessage);
      onError?.(errorMessage);
      toast.error(errorMessage);
      
      // Cleanup on failure
      stopStreaming();
      return false;
    }
  }, [isStreaming, hasPermission, requestPermission, sessionId, setupMediaRecorder, sendAudioChunk, chunkDuration, updateAudioLevel, onError]);

  // Stop streaming audio
  const stopStreaming = useCallback(() => {
    console.log('🛑 Stopping audio streaming...');
    
    try {
      // Stop recording
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }

      // Send any remaining audio chunks
      if (audioChunksRef.current.length > 0 && mediaRecorderRef.current) {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current.mimeType 
        });
        sendAudioChunk(audioBlob);
      }

      // Clear intervals
      if (intervalRef.current) {
        if (intervalRef.current.timeInterval) {
          clearInterval(intervalRef.current.timeInterval);
        }
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      // Update state
      setIsStreaming(false);
      setIsRecording(false);
      setRecordingTime(0);
      setAudioLevel(0);

      console.log('✅ Audio streaming stopped');
      toast.success('Audio streaming stopped');
      
      // Notify recording stopped
      websocketService.emit(AUDIO_EVENTS.RECORDING_STOPPED, { 
        sessionId,
        totalDuration: recordingTime,
        timestamp: Date.now()
      });

    } catch (err) {
      console.error('❌ Error stopping streaming:', err);
      const errorMessage = `Error stopping streaming: ${err.message}`;
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [isRecording, sendAudioChunk, sessionId, recordingTime, onError]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up audio streaming resources...');
    
    // Stop streaming if active
    if (isStreaming) {
      stopStreaming();
    }

    // Clear all intervals
    if (intervalRef.current) {
      if (intervalRef.current.timeInterval) {
        clearInterval(intervalRef.current.timeInterval);
      }
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    // Stop and cleanup audio resources
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Warning: Error stopping MediaRecorder during cleanup:', err);
      }
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (err) {
        console.warn('Warning: Error disconnecting audio source:', err);
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (err) {
        console.warn('Warning: Error disconnecting analyser:', err);
      }
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (err) {
        console.warn('Warning: Error closing audio context:', err);
      }
      audioContextRef.current = null;
    }

    // Reset state
    audioChunksRef.current = [];
    setIsStreaming(false);
    setIsRecording(false);
    setAudioLevel(0);
    setRecordingTime(0);
    setError(null);

    console.log('✅ Audio streaming cleanup completed');
  }, [isStreaming, stopStreaming]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Auto-start streaming when session changes and WebSocket is connected
  useEffect(() => {
    if (sessionId && websocketService.getConnectionStatus() && hasPermission && !isStreaming) {
      // Auto-start streaming for active sessions
      console.log('🔄 Auto-starting audio streaming for session:', sessionId);
      // Note: We don't auto-start here to avoid unwanted recording
      // Users should explicitly start recording
    }
  }, [sessionId, hasPermission, isStreaming]);

  // Format recording time for display
  const formatRecordingTime = useCallback((milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    // State
    isStreaming,
    isRecording,
    hasPermission,
    isRequestingPermission,
    audioLevel,
    error,
    recordingTime,
    isSupported: isSupported(),
    
    // Actions
    startStreaming,
    stopStreaming,
    requestPermission,
    cleanup,
    
    // Utilities
    formatRecordingTime,
    
    // Status helpers
    canStream: hasPermission && !!sessionId && websocketService.getConnectionStatus(),
    isReady: hasPermission && isSupported(),
  };
};

export default useAudioStreaming;
