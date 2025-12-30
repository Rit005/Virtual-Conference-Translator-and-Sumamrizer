import { useState, useEffect, useRef, useCallback } from 'react';
import { AUDIO_CONSTANTS, AUDIO_EVENTS } from '../utils/constants.js';
import websocketService from '../services/websocketService.js';
import toast from 'react-hot-toast';

/**
 * Real-time audio streaming hook
 * Streams mic audio → Socket.IO → Whisper → Translation → Live captions
 */
const useAudioStreaming = ({
  sessionId,
  language = 'en',
  chunkDuration = AUDIO_CONSTANTS.CHUNK_DURATION,
  onChunkSent,
  onError,
  onAudioLevel
}) => {
  /* ===================== STATE ===================== */
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);

  /* ===================== REFS ===================== */
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const levelIntervalRef = useRef(null);
  const recordingStartRef = useRef(null);

  /* ===================== SUPPORT CHECK ===================== */
  const isSupported = () =>
    !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.MediaRecorder &&
      window.AudioContext
    );

  /* ===================== PERMISSION ===================== */
  const requestPermission = useCallback(async () => {
    if (!isSupported()) {
      toast.error('Browser does not support audio recording');
      return false;
    }

    if (hasPermission && streamRef.current) {
      return true;
    }

    try {
      setIsRequestingPermission(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: AUDIO_CONSTANTS.CHANNELS,
          sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE
        }
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      setHasPermission(true);
      toast.success('Microphone access granted');

      websocketService.emit(AUDIO_EVENTS.PERMISSION_GRANTED, { sessionId });

      return true;
    } catch (err) {
      toast.error('Microphone access denied');
      onError?.(err.message);
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [sessionId, hasPermission, onError]);

  /* ===================== AUDIO LEVEL ===================== */
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);

    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const level = Math.min(avg / 255, 1);

    setAudioLevel(level);
    onAudioLevel?.(level);
  }, [onAudioLevel]);

  /* ===================== MEDIA RECORDER ===================== */
  const setupRecorder = () => {
    if (!streamRef.current) {
      throw new Error('Microphone not initialized');
    }

    let mimeType = AUDIO_CONSTANTS.MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
    }

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      audioBitsPerSecond: AUDIO_CONSTANTS.BIT_RATE
    });

    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data?.size) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.onerror = (e) => {
      toast.error('Recording error');
      onError?.(e.error?.message);
    };

    recorder.onstop = () => {
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    return recorder;
  };

  /* ===================== SEND CHUNK ===================== */
  const sendAudioChunk = async (blob) => {
    if (!blob || !blob.size) return;

    const buffer = await blob.arrayBuffer();
    websocketService.sendAudioChunk(
      sessionId,
      new Uint8Array(buffer),
      language
    );

    onChunkSent?.({
      size: blob.size,
      timestamp: Date.now()
    });
  };

  /* ===================== START STREAMING ===================== */
  const startStreaming = useCallback(async () => {
    if (isStreaming) return;

    if (!sessionId) {
      toast.error('Session not created');
      return;
    }

    if (!websocketService.getConnectionStatus()) {
      toast.error('WebSocket not connected');
      return;
    }

    if (!streamRef.current) {
      toast.error('Enable microphone first');
      return;
    }

    try {
      const recorder = setupRecorder();

      recorder.start(100);
      setIsStreaming(true);
      setIsRecording(true);
      recordingStartRef.current = Date.now();

      levelIntervalRef.current = setInterval(
        updateAudioLevel,
        AUDIO_CONSTANTS.AUDIO_LEVEL_UPDATE_INTERVAL
      );

      chunkIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length) {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType
          });
          audioChunksRef.current = [];
          await sendAudioChunk(blob);
        }
      }, chunkDuration);

      websocketService.emit(AUDIO_EVENTS.RECORDING_STARTED, {
        sessionId,
        language
      });

      toast.success('Audio streaming started');
    } catch (err) {
      toast.error(err.message);
      stopStreaming();
    }
  }, [sessionId, language, isStreaming, updateAudioLevel]);

  /* ===================== STOP STREAMING ===================== */
  const stopStreaming = useCallback(() => {
    if (!isStreaming) return;

    try {
      mediaRecorderRef.current?.stop();

      clearInterval(chunkIntervalRef.current);
      clearInterval(levelIntervalRef.current);

      chunkIntervalRef.current = null;
      levelIntervalRef.current = null;

      setIsStreaming(false);
      setIsRecording(false);
      setAudioLevel(0);
      setRecordingTime(0);

      websocketService.emit(AUDIO_EVENTS.RECORDING_STOPPED, { sessionId });
      toast.success('Audio streaming stopped');
    } catch (err) {
      console.warn(err);
    }
  }, [isStreaming, sessionId]);

  /* ===================== CLEANUP (SAFE) ===================== */
  const cleanup = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();

    streamRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
  }, [isStreaming, stopStreaming]);

  /* ===================== UNMOUNT ===================== */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  /* ===================== UTILS ===================== */
  const formatRecordingTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  /* ===================== RETURN ===================== */
  return {
    isStreaming,
    isRecording,
    hasPermission,
    isRequestingPermission,
    audioLevel,
    recordingTime,
    error,

    isSupported: isSupported(),
    canStream:
      hasPermission &&
      !!sessionId &&
      websocketService.getConnectionStatus(),

    requestPermission,
    startStreaming,
    stopStreaming,
    cleanup,
    formatRecordingTime
  };
};

export default useAudioStreaming;
