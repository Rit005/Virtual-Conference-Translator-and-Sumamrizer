/**
 * Streamlined TranscriptionAgent for Real-time Audio Chunk Processing
 */

import { EventEmitter } from 'events';

class TranscriptionAgent extends EventEmitter {
  constructor(options = {}) {
    super();

    if (!options.asrService) {
      throw new Error('ASR service is required. Please provide an ASR service instance.');
    }

    this.config = {
      bufferSize: options.bufferSize ?? 3,
      maxBufferSize: options.maxBufferSize ?? 6,
      bufferTimeout: options.bufferTimeout ?? 3000,
      maxRetries: options.maxRetries ?? 2,
      retryDelay: options.retryDelay ?? 1000,
      maxChunkSize: options.maxChunkSize ?? 1024 * 1024,
      asrService: options.asrService,
      enableDebugLogging: options.enableDebugLogging ?? false
    };

    this.activeSessions = new Map();
    this.isInitialized = false;

    this.stats = {
      totalSessions: 0,
      totalChunksProcessed: 0,
      totalTranscriptions: 0,
      errorCount: 0
    };
  }

  /* ================= INITIALIZATION ================= */

  async initialize() {
    try {
      this.log('Initializing TranscriptionAgent...');
      await this.config.asrService.initialize();
      this.isInitialized = true;
      this.log('TranscriptionAgent initialized');
      return true;
    } catch (error) {
      this.log('Initialization failed:', error.message);
      return false;
    }
  }

  /* ================= SESSION MANAGEMENT ================= */

  async startSession(sessionId, options = {}) {
    if (!this.isInitialized) throw new Error('Agent not initialized');
    if (!sessionId) throw new Error('sessionId required');

    if (this.activeSessions.has(sessionId)) {
      await this.stopSession(sessionId);
    }

    const session = {
      sessionId,
      startTime: Date.now(),
      language: options.language || 'en',
      chunkBuffer: [],
      bufferStartTime: Date.now(),
      isProcessing: false,
      isActive: true,
      chunksReceived: 0,
      chunksProcessed: 0,
      retryCount: 0
    };

    this.activeSessions.set(sessionId, session);
    this.stats.totalSessions++;

    this.emit('session:started', {
      sessionId,
      language: session.language,
      timestamp: Date.now()
    });

    return { success: true, sessionId };
  }

  async stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      if (session.chunkBuffer.length && !session.isProcessing) {
        await this.processSessionBuffer(sessionId);
      }
    } catch (_) {}

    this.activeSessions.delete(sessionId);

    this.emit('session:stopped', {
      sessionId,
      timestamp: Date.now()
    });
  }

  /* ================= AUDIO CHUNK HANDLING ================= */

  async processChunk(sessionId, audioData, metadata = {}) {
    if (!this.isInitialized) throw new Error('Agent not initialized');

    let session = this.activeSessions.get(sessionId);
    if (!session) {
      await this.startSession(sessionId, { language: metadata.language });
      session = this.activeSessions.get(sessionId);
    }

    const validation = this.config.asrService.validateAudioFormat(audioData);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    session.chunkBuffer.push({
      audioData,
      language: metadata.language || session.language,
      timestamp: Date.now()
    });

    session.chunksReceived++;
    this.stats.totalChunksProcessed++;

    if (session.chunkBuffer.length >= this.config.bufferSize) {
      this.processSessionBuffer(sessionId).catch(() => {});
    }

    this.setupBufferTimeout(sessionId);

    return { success: true };
  }

  /* ================= BUFFER PROCESSING ================= */

  async processSessionBuffer(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.isProcessing || !session.chunkBuffer.length) return;

    session.isProcessing = true;

    try {
      const chunks = session.chunkBuffer.splice(0, this.config.bufferSize);
      const combinedAudio = this.combineAudioChunks(chunks);

      const result = await this.transcribeWithRetry(sessionId, combinedAudio, {
        language: session.language
      });

      session.chunksProcessed += chunks.length;
      this.stats.totalTranscriptions++;

      // 🔥 Correct EventEmitter usage
      this.emit('transcription:partial', {
        sessionId,
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        isFinal: result.isFinal ?? false,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      this.stats.errorCount++;
      this.emit('transcription:error', {
        sessionId,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    } finally {
      session.isProcessing = false;
      session.bufferStartTime = Date.now();
    }
  }

  /* ================= HELPERS ================= */

  setupBufferTimeout(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.isProcessing) return;

    setTimeout(() => {
      if (session.chunkBuffer.length && !session.isProcessing) {
        this.processSessionBuffer(sessionId).catch(() => {});
      }
    }, this.config.bufferTimeout);
  }

  combineAudioChunks(chunks) {
    const buffers = chunks.map(c =>
      Buffer.isBuffer(c.audioData)
        ? c.audioData
        : Buffer.from(c.audioData, 'base64')
    );
    return Buffer.concat(buffers);
  }

  async transcribeWithRetry(sessionId, audioData, options) {
    let lastError;
    for (let i = 1; i <= this.config.maxRetries; i++) {
      try {
        return await this.config.asrService.transcribe(audioData, options);
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, this.config.retryDelay * i));
      }
    }
    throw lastError;
  }

  /* ================= SHUTDOWN ================= */

  async shutdown() {
    for (const sessionId of this.activeSessions.keys()) {
      await this.stopSession(sessionId);
    }
    await this.config.asrService.cleanup();
    this.isInitialized = false;
  }

  log(message, data) {
    if (this.config.enableDebugLogging) {
      console.log('[TranscriptionAgent]', message, data ?? '');
    }
  }
}

export default TranscriptionAgent;
