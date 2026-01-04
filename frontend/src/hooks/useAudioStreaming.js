import { useState, useEffect, useRef, useCallback } from 'react';
import websocketService from '../services/websocketService';
import toast from 'react-hot-toast';

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

const useAudioStreaming = ({
  sessionId,
  language = 'en',
  onChunkSent,
  onError,
  onAudioLevel
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  /* ===================== PERMISSION ===================== */
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!isStreaming) return;

        const input = e.inputBuffer.getChannelData(0);

        /* 🔊 AUDIO LEVEL */
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setAudioLevel(rms);
        onAudioLevel?.(rms);

        /* 🔥 SEND FLOAT32 PCM (BACKEND EXPECTS THIS) */
        const float32Chunk = new Float32Array(input);

        websocketService.sendAudioChunk({
          sessionId,
          audio: float32Chunk,
          
      });

        onChunkSent?.({
          size: float32Chunk.byteLength,
          timestamp: Date.now()
        });
      };

      audioContextRef.current = audioContext;
      processorRef.current = processor;
      streamRef.current = stream;

      setHasPermission(true);
      toast.success('Microphone ready');
      return true;
    } catch (err) {
      toast.error('Microphone permission denied');
      onError?.(err.message);
      return false;
    }
  }, [sessionId, language, isStreaming]);

  /* ===================== START ===================== */
  const startStreaming = useCallback(() => {
    if (!hasPermission || !sessionId) {
      toast.error('Microphone or session missing');
      return false;
    }
  
    if (!websocketService.getConnectionStatus()) {
      toast.error('WebSocket disconnected');
      return false;
    }
  
    setIsStreaming(true);
    toast.success('Live transcription started');
    return true; 
  }, [hasPermission, sessionId]);
  
  /* ===================== STOP ===================== */
  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    setAudioLevel(0);
    toast.success('Streaming stopped');
  }, []);

  /* ===================== CLEANUP ===================== */
  useEffect(() => {
    return () => {
      processorRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    isStreaming,
    hasPermission,
    audioLevel,
  
    
    isReady: hasPermission,
    isSupported: true,
  
    requestPermission,
    startStreaming,
    stopStreaming
  };
  
};

export default useAudioStreaming;