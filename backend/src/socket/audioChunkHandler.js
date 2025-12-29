import { EventEmitter } from 'events';
import errorLogger from '../utils/errorLogger.js';
import AdvancedRateLimiter from '../utils/enhancedRateLimiter.js';


import TranscriptionAgent from '../agents/transcriptionAgentRefined.js';
import WhisperService from '../services/whisper.service.js';

/**
 * AudioChunkHandler
 * Handles audio chunk streaming & transcription pipeline
 */
class AudioChunkHandler {
  constructor(io, options = {}) {
    this.io = io;

    /* ================= CONFIG ================= */

    this.config = {
      maxChunkSize: options.maxChunkSize || 1024 * 1024,
      enableDebugLogging: options.enableDebugLogging ?? false,
      chunkBufferSize: options.chunkBufferSize || 3
    };

    /* ================= CREATE TRANSCRIPTION AGENT ================= */

    const whisperService = new WhisperService();

    this.transcriptionAgent = new TranscriptionAgent({
      asrService: whisperService,
      bufferSize: this.config.chunkBufferSize,
      maxChunkSize: this.config.maxChunkSize,
      enableDebugLogging: this.config.enableDebugLogging
    });

    /* ================= RATE LIMITER ================= */

    this.rateLimiter = new AdvancedRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
      burstLimit: 15,
      burstWindow: 2000,
      keyGenerator: (sessionId, userId) => `audio:${sessionId}:${userId}`
    });

    /* ================= STATE ================= */

    this.activeStreams = new Map();
    this.chunkStats = new Map();
    this.errorCounts = new Map();
    this.lastActivity = new Map();

    this.eventEmitter = new EventEmitter();
    this.initialized = false;

    this.setupErrorLogging();
  }

  /* ================= INITIALIZATION ================= */

  async initialize() {
    if (this.initialized) return;

    await this.transcriptionAgent.initialize();

    this.setupTranscriptionEventListeners();

    this.initialized = true;

    console.log('🎤 AudioChunkHandler initialized with TranscriptionAgent');
  }

  setupErrorLogging() {
    errorLogger.setGlobalContext({
      component: 'audio_chunk_handler'
    });
  }

  /* ================= TRANSCRIPTION EVENTS ================= */

  setupTranscriptionEventListeners() {
    if (!this.transcriptionAgent || typeof this.transcriptionAgent.on !== 'function') {
      throw new Error('❌ transcriptionAgent is not an EventEmitter');
    }

    this.transcriptionAgent.on('transcription:partial', (data) => {
      this.handlePartialTranscription(data);
    });

    this.transcriptionAgent.on('transcription:error', (data) => {
      this.handleTranscriptionError(data);
    });

    this.transcriptionAgent.on('session:started', (data) => {
      this.logDebug('Transcription session started', data);
    });

    this.transcriptionAgent.on('session:stopped', (data) => {
      this.logDebug('Transcription session stopped', data);
    });
  }

  /* ================= AUDIO CHUNK HANDLING ================= */

  async handleAudioChunk(socket, data) {
    const { sessionId, audioData, chunkId, language = 'en' } = data;
    const userId = socket.userId;

    try {
      this.validateChunkData({ sessionId, audioData, chunkId, userId });

      const limit = this.rateLimiter.checkLimit(`${sessionId}:${userId}`);
      if (!limit.allowed) {
        socket.emit('audio:chunk:rate_limited', limit);
        return;
      }

      this.lastActivity.set(sessionId, Date.now());
      this.getOrCreateStreamSession(sessionId, userId);

      await this.transcriptionAgent.processChunk(sessionId, audioData, {
        chunkId,
        language,
        userId
      });

      this.updateSessionStats(sessionId, audioData);
    } catch (error) {
      this.handleChunkError(socket, sessionId, chunkId, error);
    }
  }

  /* ================= STREAM CONTROL ================= */

  async startAudioStream(sessionId, userId, options = {}) {
    await this.transcriptionAgent.startSession(sessionId, {
      language: options.language || 'en'
    });

    this.initializeSessionStats(sessionId);

    this.io.to(sessionId).emit('audio:stream:started', {
      sessionId,
      userId
    });
  }

  async stopAudioStream(sessionId) {
    await this.transcriptionAgent.stopSession(sessionId);
    this.cleanupStreamSession(sessionId);

    this.io.to(sessionId).emit('audio:stream:stopped', { sessionId });
  }

  async handleDisconnect(socket) {
    const userId = socket.userId;
    if (!userId) return;

    for (const [sessionId, stream] of this.activeStreams.entries()) {
      if (stream.userId === userId) {
        await this.stopAudioStream(sessionId);
      }
    }
  }

  /* ================= TRANSCRIPTION OUTPUT ================= */

  handlePartialTranscription(data) {
    this.io.to(data.sessionId).emit('transcription:partial', {
      ...data,
      timestamp: Date.now()
    });
  }

  handleTranscriptionError(data) {
    this.io.to(data.sessionId).emit('transcription:error', data);
  }

  /* ================= HELPERS ================= */

  validateChunkData({ sessionId, audioData, chunkId, userId }) {
    if (!sessionId) throw new Error('Missing sessionId');
    if (!audioData) throw new Error('Missing audioData');
    if (!chunkId) throw new Error('Missing chunkId');
    if (!userId) throw new Error('Missing userId');

    const size = this.getChunkSize(audioData);
    if (size > this.config.maxChunkSize) {
      throw new Error('Audio chunk too large');
    }
  }

  getOrCreateStreamSession(sessionId, userId) {
    if (!this.activeStreams.has(sessionId)) {
      this.activeStreams.set(sessionId, {
        sessionId,
        userId,
        startTime: Date.now(),
        chunksReceived: 0,
        totalBytes: 0
      });
    }
    return this.activeStreams.get(sessionId);
  }

  initializeSessionStats(sessionId) {
    this.chunkStats.set(sessionId, {
      chunksReceived: 0,
      totalBytes: 0,
      processingErrors: 0
    });
  }

  updateSessionStats(sessionId, audioData) {
    const stats = this.chunkStats.get(sessionId);
    const size = this.getChunkSize(audioData);

    if (stats) {
      stats.chunksReceived += 1;
      stats.totalBytes += size;
    }

    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      stream.chunksReceived += 1;
      stream.totalBytes += size;
    }
  }

  cleanupStreamSession(sessionId) {
    this.activeStreams.delete(sessionId);
  }

  handleChunkError(socket, sessionId, chunkId, error) {
    socket.emit('audio:chunk:error', {
      sessionId,
      chunkId,
      error: error.message
    });

    const stats = this.chunkStats.get(sessionId);
    if (stats) stats.processingErrors += 1;
  }

  getChunkSize(audioData) {
    if (Buffer.isBuffer(audioData)) return audioData.length;
    if (typeof audioData === 'string') return audioData.length;
    return 0;
  }

  logDebug(message, data) {
    if (this.config.enableDebugLogging) {
      console.log('[AudioChunkHandler]', message, data ?? '');
    }
  }
}

export default AudioChunkHandler;
