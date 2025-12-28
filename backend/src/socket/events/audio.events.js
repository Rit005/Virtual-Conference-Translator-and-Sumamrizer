/**
 * Audio Event Definitions
 * 
 * Centralized event definitions for audio chunk handling.
 * This provides a clean contract between components and ensures
 * consistent event naming across the system.
 */

export const AUDIO_EVENTS = {
  // Client to Server Events
  CLIENT: {
    CHUNK: 'audio:chunk',
    START_STREAM: 'audio:stream:start',
    STOP_STREAM: 'audio:stream:stop',
    GET_STATUS: 'audio:stream:status'
  },

  // Server to Client Events  
  SERVER: {
    CHUNK_RECEIVED: 'audio:chunk:received',
    CHUNK_PROCESSED: 'audio:chunk:processed',
    CHUNK_ERROR: 'audio:chunk:error',
    TRANSCRIPTION: 'audio:transcription',
    STREAM_STARTED: 'audio:stream:started',
    STREAM_STOPPED: 'audio:stream:stopped',
    STREAM_STATUS: 'audio:stream:status'
  },

  // Internal System Events (EventEmitter)
  INTERNAL: {
    CHUNK_RECEIVED: 'chunk:received',
    CHUNK_PROCESSED: 'chunk:processed',
    CHUNK_ERROR: 'chunk:error',
    STREAM_STARTED: 'stream:started',
    STREAM_STOPPED: 'stream:stopped',
    STREAM_PROCESSING_ERROR: 'stream:processing:error',
    CHUNK_PROCESSING_ERROR: 'chunk:processing:error'
  }
};

export const EVENT_PRIORITIES = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

export const AUDIO_CONFIG = {
  DEFAULT_CHUNK_SIZE: 1024 * 1024, // 1MB
  DEFAULT_BUFFER_SIZE: 10,
  DEFAULT_PROCESSING_TIMEOUT: 30000, // 30 seconds
  MAX_CHUNK_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_CHUNK_SIZE: 1024, // 1KB
  CHUNK_TIMEOUT: 10000 // 10 seconds
};

export const AUDIO_MESSAGES = {
  CHUNK_TOO_LARGE: (size, maxSize) => 
    `Audio chunk size (${size} bytes) exceeds maximum allowed (${maxSize} bytes)`,
  
  INVALID_CHUNK_DATA: 'Invalid chunk data provided',
  NO_ACTIVE_STREAM: 'No active audio stream for session',
  STREAM_ALREADY_ACTIVE: 'Audio stream already active for session',
  PROCESSING_TIMEOUT: 'Audio chunk processing timed out',
  TRANSCRIPTION_FAILED: 'Audio transcription failed',
  UNSUPPORTED_LANGUAGE: 'Unsupported language for transcription'
};

export const AUDIO_CONSTANTS = {
  SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'hi', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
  DEFAULT_LANGUAGE: 'en',
  CONFIDENCE_THRESHOLD: 0.7,
  MAX_CONCURRENT_STREAMS: 100,
  BUFFER_FLUSH_INTERVAL: 5000, // 5 seconds
  CLEANUP_INTERVAL: 60000 // 1 minute
};

export const AUDIO_METRICS = {
  CHUNKS_PROCESSED: 'audio_chunks_processed_total',
  CHUNKS_FAILED: 'audio_chunks_failed_total',
  PROCESSING_TIME: 'audio_processing_time_seconds',
  STREAM_DURATION: 'audio_stream_duration_seconds',
  BYTES_PROCESSED: 'audio_bytes_processed_total',
  ACTIVE_STREAMS: 'audio_active_streams_current'
};

export default {
  EVENTS: AUDIO_EVENTS,
  PRIORITIES: EVENT_PRIORITIES,
  CONFIG: AUDIO_CONFIG,
  MESSAGES: AUDIO_MESSAGES,
  CONSTANTS: AUDIO_CONSTANTS,
  METRICS: AUDIO_METRICS
};
