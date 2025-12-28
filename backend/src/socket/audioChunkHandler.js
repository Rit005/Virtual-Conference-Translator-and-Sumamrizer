import { EventEmitter } from 'events';
import errorLogger from '../utils/errorLogger.js';
import AdvancedRateLimiter from '../utils/enhancedRateLimiter.js';

/**
 * AudioChunkHandler - Enhanced Integration with TranscriptionAgent
 * 
 * Handles audio chunk streaming with event-driven architecture.
 * Responsibilities:
 * - Stream session management
 * - Audio chunk routing to TranscriptionAgent
 * - Transcription event broadcasting
 * - WebSocket communication coordination
 * - Comprehensive logging and debugging
 */

class AudioChunkHandler {
  constructor(io, transcriptionAgent, options = {}) {
    this.io = io;
    this.transcriptionAgent = transcriptionAgent;
    
    // Configuration
    this.config = {
      maxChunkSize: options.maxChunkSize || 1024 * 1024, // 1MB max chunk size
      enableDebugLogging: options.enableDebugLogging !== false,
      enableRateLimiting: options.enableRateLimiting !== false,
      rateLimitConfig: {
        maxRequests: options.maxAudioChunks || 10,
        burstLimit: options.burstLimit || 15,
        burstWindow: options.burstWindow || 2000
      }
    };

    // Initialize advanced rate limiter
    if (this.config.enableRateLimiting) {
      this.rateLimiter = new AdvancedRateLimiter({
        maxRequests: this.config.rateLimitConfig.maxRequests,
        windowMs: 1000,
        burstLimit: this.config.rateLimitConfig.burstLimit,
        burstWindow: this.config.rateLimitConfig.burstWindow,
        keyGenerator: (sessionId, userId) => `audio:${sessionId}:${userId}`,
        message: 'Audio chunk rate limit exceeded. Please slow down your speech.'
      });
    }

    // Stream state management
    this.activeStreams = new Map(); // sessionId -> StreamSession
    this.chunkStats = new Map(); // sessionId -> statistics
    this.eventEmitter = new EventEmitter();

    // Enhanced error tracking and logging
    this.errorCounts = new Map(); // sessionId -> error count
    this.processingLatencies = new Map(); // sessionId -> average latency
    this.lastActivity = new Map(); // sessionId -> last activity time

    // Debug tracking
    this.debugLog = [];
    this.maxDebugEntries = 1000;

    // Setup error logging context
    this.setupErrorLogging();
  }

  /**
   * Setup error logging with component context
   */
  setupErrorLogging() {
    errorLogger.setGlobalContext({
      component: 'audio_chunk_handler',
      version: '2.0.0'
    });
  }

  /**
   * Initialize event listeners and handlers
   */
  initialize() {
    console.log('🎤 AudioChunkHandler initialized with enhanced TranscriptionAgent integration');

    // Set up event listeners for transcription results
    this.setupTranscriptionEventListeners();

    return this;
  }

  /**
   * Handle incoming audio chunk from client with enhanced error handling and rate limiting
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Chunk data { sessionId, audioData, chunkId, timestamp, language }
   */
  async handleAudioChunk(socket, data) {
    const { sessionId, audioData, chunkId, timestamp, language = 'en' } = data;
    const userId = socket.userId;
    const processingStartTime = Date.now();
    const requestId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Enhanced context for logging
    const chunkContext = {
      requestId,
      sessionId,
      userId,
      chunkId,
      language,
      socketId: socket.id,
      audioSize: this.getChunkSize(audioData),
      timestamp: timestamp || Date.now()
    };

    try {
      // Enhanced input validation with detailed error logging
      try {
        this.validateChunkData({ sessionId, audioData, chunkId, userId });
      } catch (validationError) {
        errorLogger.warn('audio_chunk_validation_failed', 'Audio chunk validation failed', {
          ...chunkContext,
          validationError: validationError.message
        });
        throw validationError;
      }

      // Check rate limiting if enabled
      if (this.rateLimiter) {
        const rateLimitResult = this.rateLimiter.checkLimit(
          `${sessionId}:${userId}`,
          'HIGH', // Audio chunks have high priority
          chunkContext
        );

        if (!rateLimitResult.allowed) {
          errorLogger.warn('audio_chunk_rate_limited', 'Audio chunk rejected due to rate limiting', {
            ...chunkContext,
            rateLimitResult,
            reason: rateLimitResult.reason
          });

          // Emit rate limit warning to client
          socket.emit('audio:chunk:rate_limit_warning', {
            sessionId,
            chunkId,
            reason: rateLimitResult.reason,
            resetTime: rateLimitResult.resetTime,
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
            priority: rateLimitResult.priority,
            effectiveLimit: rateLimitResult.effectiveLimit,
            timestamp: Date.now()
          });

          return; // Stop processing this chunk
        }

        // Log successful rate limit check
        errorLogger.debug('audio_chunk_rate_limit_ok', 'Audio chunk passed rate limiting', {
          ...chunkContext,
          rateLimitResult: {
            priority: rateLimitResult.priority,
            remaining: rateLimitResult.remaining,
            burstCount: rateLimitResult.burstCount
          }
        });
      }

      // Update last activity tracking
      this.lastActivity.set(sessionId, Date.now());

      // Get or create stream session
      const streamSession = this.getOrCreateStreamSession(sessionId, userId);

      // Log chunk receipt with enhanced context
      errorLogger.debug('audio_chunk_received', 'Processing audio chunk', {
        ...chunkContext,
        streamActive: streamSession.isActive,
        totalChunksReceived: streamSession.chunksReceived,
        sessionActiveStreams: this.activeStreams.size
      });

      // Validate audio data size before processing
      const chunkSize = this.getChunkSize(audioData);
      if (chunkSize > this.config.maxChunkSize) {
        const sizeError = new Error(`Chunk size ${chunkSize} exceeds maximum ${this.config.maxChunkSize}`);
        errorLogger.warn('audio_chunk_size_exceeded', 'Audio chunk size limit exceeded', {
          ...chunkContext,
          chunkSize,
          maxSize: this.config.maxChunkSize,
          sizeInKB: Math.round(chunkSize / 1024)
        });
        throw sizeError;
      }

      // Route chunk to TranscriptionAgent for processing with enhanced error handling
      try {
        const transcriptionContext = {
          ...chunkContext,
          processingStartTime,
          requestId
        };

        errorLogger.debug('audio_chunk_transcription_started', 'Starting transcription processing', transcriptionContext);

        await this.transcriptionAgent.processChunk(sessionId, audioData, {
          chunkId,
          timestamp,
          language,
          userId,
          socketId: socket.id,
          requestId
        });

        const processingTime = Date.now() - processingStartTime;
        this.updateProcessingLatency(sessionId, processingTime);

        errorLogger.debug('audio_chunk_transcription_completed', 'Transcription processing completed', {
          ...transcriptionContext,
          processingTime,
          latencyMs: processingTime
        });

      } catch (transcriptionError) {
        // Increment error count for this session
        const currentErrors = this.errorCounts.get(sessionId) || 0;
        this.errorCounts.set(sessionId, currentErrors + 1);

        errorLogger.error('audio_chunk_transcription_error', 'Transcription processing failed', {
          ...chunkContext,
          transcriptionError: transcriptionError.message,
          processingTime: Date.now() - processingStartTime,
          sessionErrorCount: currentErrors + 1,
          stackTrace: transcriptionError.stack
        }, transcriptionError);

        throw transcriptionError;
      }

      // Update session statistics
      this.updateSessionStats(sessionId, audioData);

      // Emit chunk received event with enhanced data
      const chunkEvent = {
        sessionId,
        userId,
        chunkId,
        chunkSize: this.getChunkSize(audioData),
        timestamp: new Date(),
        processingTime: Date.now() - processingStartTime,
        requestId,
        rateLimited: false
      };

      this.eventEmitter.emit('chunk:received', chunkEvent);

      // Log successful processing
      errorLogger.debug('audio_chunk_processed_success', 'Audio chunk processed successfully', {
        ...chunkContext,
        processingTime: Date.now() - processingStartTime,
        totalSessionChunks: this.chunkStats.get(sessionId)?.chunksReceived || 0
      });

    } catch (error) {
      // Enhanced error handling with comprehensive logging
      const processingTime = Date.now() - processingStartTime;
      const errorContext = {
        ...chunkContext,
        processingTime,
        errorType: error.constructor.name,
        errorMessage: error.message,
        stackTrace: error.stack
      };

      // Increment error count for this session
      const currentErrors = this.errorCounts.get(sessionId) || 0;
      this.errorCounts.set(sessionId, currentErrors + 1);

      // Log different error levels based on error type
      if (error.message.includes('rate limit') || error.message.includes('validation')) {
        errorLogger.warn('audio_chunk_client_error', 'Audio chunk client error', errorContext);
      } else if (error.message.includes('transcription') || error.message.includes('processing')) {
        errorLogger.error('audio_chunk_processing_error', 'Audio chunk processing error', errorContext, error);
      } else {
        errorLogger.critical('audio_chunk_critical_error', 'Audio chunk critical error', errorContext, error);
      }

      this.handleChunkError(socket, sessionId, chunkId, error, errorContext);
    }
  }

  /**
   * Start audio stream for a session
   * @param {string} sessionId - Conference session identifier
   * @param {string} userId - User starting the stream
   * @param {Object} options - Stream options
   */
  async startAudioStream(sessionId, userId, options = {}) {
    try {
      console.log(`🎬 Starting audio stream for session ${sessionId} by user ${userId}`);

      const streamSession = this.getOrCreateStreamSession(sessionId, userId);
      streamSession.isActive = true;
      streamSession.startTime = Date.now();

      // Start transcription session
      await this.transcriptionAgent.startSession(sessionId, {
        language: options.language || 'en',
        autoDetectLanguage: options.autoDetectLanguage !== false
      });

      // Initialize statistics
      this.initializeSessionStats(sessionId);

      // Emit stream started event
      this.eventEmitter.emit('stream:started', {
        sessionId,
        userId,
        timestamp: new Date(),
        config: this.config
      });

      // Notify session participants
      this.io.to(sessionId).emit('audio:stream:started', {
        sessionId,
        userId,
        timestamp: new Date()
      });

      this.logDebug(`Audio stream started for session ${sessionId}`);

    } catch (error) {
      console.error('❌ Error starting audio stream:', error);
      throw error;
    }
  }

  /**
   * Stop audio stream for a session
   * @param {string} sessionId - Conference session identifier
   * @param {string} userId - User stopping the stream
   */
  async stopAudioStream(sessionId, userId) {
    try {
      console.log(`🛑 Stopping audio stream for session ${sessionId} by user ${userId}`);

      const streamSession = this.activeStreams.get(sessionId);
      if (!streamSession) {
        throw new Error('No active stream found for session');
      }

      // Stop transcription session
      await this.transcriptionAgent.stopSession(sessionId);

      // Generate stream statistics
      const stats = this.generateStreamStatistics(sessionId);

      // Clean up stream session
      this.cleanupStreamSession(sessionId);

      // Emit stream stopped event
      this.eventEmitter.emit('stream:stopped', {
        sessionId,
        userId,
        timestamp: new Date(),
        stats
      });

      // Notify session participants
      this.io.to(sessionId).emit('audio:stream:stopped', {
        sessionId,
        userId,
        timestamp: new Date(),
        stats
      });

      this.logDebug(`Audio stream stopped for session ${sessionId}`, stats);

    } catch (error) {
      console.error('❌ Error stopping audio stream:', error);
      throw error;
    }
  }

  /**
   * Handle client disconnect - graceful cleanup
   * @param {Object} socket - Disconnecting socket
   */
  async handleDisconnect(socket) {
    const userId = socket.userId;
    if (!userId) return;

    console.log(`🔌 Handling disconnect for user ${userId}`);

    try {
      // Find all sessions this user was streaming to
      const userSessions = [];
      for (const [sessionId, streamSession] of this.activeStreams.entries()) {
        if (streamSession.userId === userId) {
          userSessions.push(sessionId);
        }
      }

      // Stop streams for each session
      for (const sessionId of userSessions) {
        await this.stopAudioStream(sessionId, userId);
      }

      // Clean up any buffered chunks
      this.cleanupUserChunks(userId);

      this.logDebug(`Disconnect handled for user ${userId}`, {
        sessionsStopped: userSessions.length
      });

    } catch (error) {
      console.error('❌ Error handling disconnect:', error);
    }
  }

  /**
   * Get audio stream status for a session
   * @param {string} sessionId - Conference session identifier
   */
  getStreamStatus(sessionId) {
    const streamSession = this.activeStreams.get(sessionId);
    const stats = this.chunkStats.get(sessionId);
    const transcriptionStats = this.transcriptionAgent.getSessionStatus(sessionId);

    if (!streamSession) {
      return {
        active: false,
        sessionId,
        message: 'No active stream'
      };
    }

    return {
      active: true,
      sessionId,
      userId: streamSession.userId,
      startTime: streamSession.startTime,
      duration: Date.now() - streamSession.startTime,
      chunksReceived: streamSession.chunksReceived || 0,
      totalBytes: streamSession.totalBytes || 0,
      processingErrors: stats?.processingErrors || 0,
      transcription: {
        active: transcriptionStats.active,
        bufferLength: transcriptionStats.bufferLength || 0,
        chunksProcessed: transcriptionStats.chunksProcessed || 0
      }
    };
  }

  /**
   * Get comprehensive statistics for debugging
   */
  getDebugStats() {
    const activeStreams = Array.from(this.activeStreams.entries()).map(([sessionId, session]) => ({
      sessionId,
      userId: session.userId,
      duration: Date.now() - session.startTime,
      chunksReceived: session.chunksReceived,
      totalBytes: session.totalBytes,
      isActive: session.isActive
    }));

    const sessionStats = Array.from(this.chunkStats.entries()).map(([sessionId, stats]) => ({
      sessionId,
      ...stats
    }));

    // Get transcription stats
    const transcriptionStats = this.transcriptionAgent.getStats();

    return {
      activeStreams,
      sessionStats,
      totalActiveStreams: this.activeStreams.size,
      totalChunksReceived: activeStreams.reduce((sum, stream) => sum + stream.chunksReceived, 0),
      transcription: transcriptionStats,
      recentDebugLog: this.debugLog.slice(-20) // Last 20 debug entries
    };
  }

  // Private helper methods

  /**
   * Validate incoming chunk data
   */
  validateChunkData({ sessionId, audioData, chunkId, userId }) {
    if (!sessionId) {
      throw new Error('Missing sessionId');
    }
    if (!audioData) {
      throw new Error('Missing audioData');
    }
    if (!chunkId) {
      throw new Error('Missing chunkId');
    }
    if (!userId) {
      throw new Error('Missing userId');
    }

    const chunkSize = this.getChunkSize(audioData);
    if (chunkSize > this.config.maxChunkSize) {
      throw new Error(`Chunk size ${chunkSize} exceeds maximum ${this.config.maxChunkSize}`);
    }
  }

  /**
   * Get or create stream session
   */
  getOrCreateStreamSession(sessionId, userId) {
    if (!this.activeStreams.has(sessionId)) {
      this.activeStreams.set(sessionId, {
        sessionId,
        userId,
        startTime: Date.now(),
        isActive: false,
        chunksReceived: 0,
        totalBytes: 0
      });
    }

    return this.activeStreams.get(sessionId);
  }

  /**
   * Initialize session statistics
   */
  initializeSessionStats(sessionId) {
    this.chunkStats.set(sessionId, {
      sessionId,
      chunksReceived: 0,
      totalBytes: 0,
      averageChunkSize: 0,
      processingErrors: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
  }

  /**
   * Update session statistics when chunk is received
   */
  updateSessionStats(sessionId, audioData) {
    const stats = this.chunkStats.get(sessionId);
    const chunkSize = this.getChunkSize(audioData);
    
    if (stats) {
      stats.chunksReceived += 1;
      stats.totalBytes += chunkSize;
      stats.averageChunkSize = stats.totalBytes / stats.chunksReceived;
      stats.lastActivity = Date.now();
      this.chunkStats.set(sessionId, stats);
    }

    // Update stream session stats
    const streamSession = this.activeStreams.get(sessionId);
    if (streamSession) {
      streamSession.chunksReceived += 1;
      streamSession.totalBytes += chunkSize;
    }
  }

  /**
   * Generate stream statistics
   */
  generateStreamStatistics(sessionId) {
    const stats = this.chunkStats.get(sessionId);
    const streamSession = this.activeStreams.get(sessionId);
    const transcriptionStats = this.transcriptionAgent.getSessionStatus(sessionId);

    if (!stats || !streamSession) {
      return null;
    }

    return {
      sessionId,
      duration: Date.now() - streamSession.startTime,
      chunksReceived: stats.chunksReceived,
      totalBytes: stats.totalBytes,
      averageChunkSize: stats.averageChunkSize,
      processingErrors: stats.processingErrors,
      transcription: {
        active: transcriptionStats.active,
        chunksProcessed: transcriptionStats.chunksProcessed || 0,
        bufferLength: transcriptionStats.bufferLength || 0
      }
    };
  }

  /**
   * Clean up stream session resources
   */
  cleanupStreamSession(sessionId) {
    this.activeStreams.delete(sessionId);
    // Keep stats for debugging
  }

  /**
   * Clean up user chunks on disconnect
   */
  cleanupUserChunks(userId) {
    for (const [sessionId, streamSession] of this.activeStreams.entries()) {
      if (streamSession.userId === userId) {
        this.cleanupStreamSession(sessionId);
      }
    }
  }

  /**
   * Handle partial transcription events
   */
  handlePartialTranscription(data) {
    const { sessionId, text, confidence, language, isFinal, chunkCount, processingTime } = data;
    
    console.log(`🎤 Partial transcription for session ${sessionId}: "${text.substring(0, 50)}..."`);

    // Broadcast to all session participants
    this.io.to(sessionId).emit('transcription:partial', {
      sessionId,
      text,
      confidence,
      language,
      isFinal,
      chunkCount,
      processingTime,
      timestamp: new Date()
    });

    this.logDebug('Partial transcription broadcasted', {
      sessionId,
      textLength: text.length,
      confidence,
      isFinal
    });
  }

  /**
   * Handle transcription errors
   */
  handleTranscriptionError(data) {
    const { sessionId, error } = data;
    
    console.error(`❌ Transcription error for session ${sessionId}:`, error);

    // Broadcast error to session participants
    this.io.to(sessionId).emit('transcription:error', {
      sessionId,
      error,
      timestamp: new Date()
    });

    // Update error statistics
    const stats = this.chunkStats.get(sessionId);
    if (stats) {
      stats.processingErrors += 1;
    }

    this.logDebug('Transcription error handled', { sessionId, error });
  }

  /**
   * Handle chunk errors
   */
  handleChunkError(socket, sessionId, chunkId, error) {
    console.error(`❌ Audio chunk error for session ${sessionId}, chunk ${chunkId}:`, error);

    // Update error statistics
    const stats = this.chunkStats.get(sessionId);
    if (stats) {
      stats.processingErrors += 1;
    }

    // Emit error event
    this.eventEmitter.emit('chunk:error', {
      sessionId,
      chunkId,
      error: error.message,
      timestamp: new Date()
    });

    // Send error response to client
    socket.emit('audio:chunk:error', {
      sessionId,
      chunkId,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Set up transcription event listeners
   */
  setupTranscriptionEventListeners() {
    // Listen for transcription events from TranscriptionAgent
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

    this.transcriptionAgent.on('chunk:error', (data) => {
      this.logDebug('Chunk error in transcription', data);
    });
  }

  /**
   * Log chunk received with detailed information
   */
  logChunkReceived(sessionId, userId, chunkId, audioData) {
    const chunkSize = this.getChunkSize(audioData);

    console.log(`🎤 Audio chunk received:`, {
      sessionId,
      userId,
      chunkId,
      chunkSize: `${(chunkSize / 1024).toFixed(2)}KB`,
      timestamp: new Date().toISOString()
    });

    this.logDebug(`Chunk received from user ${userId}`, {
      sessionId,
      chunkId,
      chunkSize
    });
  }

  /**
   * Get chunk size from audio data
   */
  getChunkSize(audioData) {
    if (typeof audioData === 'string') {
      return audioData.length;
    }
    if (audioData && typeof audioData.byteLength === 'number') {
      return audioData.byteLength;
    }
    if (audioData && typeof audioData.length === 'number') {
      return audioData.length;
    }
    return 0;
  }

  /**
   * Debug logging with circular buffer
   */
  logDebug(message, data = null) {
    if (!this.config.enableDebugLogging) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };

    this.debugLog.push(logEntry);

    // Maintain circular buffer
    if (this.debugLog.length > this.maxDebugEntries) {
      this.debugLog.splice(0, this.debugLog.length - this.maxDebugEntries);
    }
  }
}

export default AudioChunkHandler;
