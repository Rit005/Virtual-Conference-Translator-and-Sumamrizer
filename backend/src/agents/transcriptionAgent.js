/**
 * Enhanced TranscriptionAgent with Real-time Chunk Processing
 * 
 * Handles audio chunk buffering, processing, and real-time transcription
 * with event-driven architecture and ASR service abstraction.
 */

import { EventEmitter } from 'events';
import WhisperService from '../services/whisper.service.js';

class TranscriptionAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.config = {
      // Buffer settings
      bufferSize: options.bufferSize || 5, // Number of chunks to buffer before processing
      maxBufferSize: options.maxBufferSize || 10, // Maximum chunks in buffer
      bufferTimeout: options.bufferTimeout || 10000, // 10 seconds - flush buffer after this time
      
      // Processing settings
      chunkDuration: options.chunkDuration || 2000, // Expected chunk duration in ms
      processingTimeout: options.processingTimeout || 30000, // 30 seconds timeout
      maxRetries: options.maxRetries || 3,
      
      // Audio settings
      supportedFormats: options.supportedFormats || ['mp3', 'wav', 'm4a', 'webm'],
      maxChunkSize: options.maxChunkSize || 1024 * 1024, // 1MB
      
      // ASR service
      asrService: options.asrService || new WhisperService(),
      
      // Debug settings
      enableDebugLogging: options.enableDebugLogging !== false,
      ...options
    };

    // Core state management
    this.activeSessions = new Map(); // sessionId -> SessionState
    this.isInitialized = false;
    this.isShuttingDown = false;

    // Statistics
    this.stats = {
      totalSessions: 0,
      totalChunksProcessed: 0,
      totalTranscriptions: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      startTime: Date.now()
    };

    // Processing queues
    this.processingQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the TranscriptionAgent
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    try {
      console.log('🎤 Initializing TranscriptionAgent...');
      
      // Initialize ASR service
      const asrInitialized = await this.config.asrService.initialize();
      if (!asrInitialized) {
        throw new Error('Failed to initialize ASR service');
      }

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ TranscriptionAgent initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize TranscriptionAgent:', error.message);
      return false;
    }
  }

  /**
   * Start a new transcription session
   * @param {string} sessionId - Conference session identifier
   * @param {Object} options - Session options
   * @returns {Promise<Object>} Session result
   */
  async startSession(sessionId, options = {}) {
    if (this.isShuttingDown) {
      throw new Error('TranscriptionAgent is shutting down');
    }

    if (!this.isInitialized) {
      throw new Error('TranscriptionAgent not initialized');
    }

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    if (this.activeSessions.has(sessionId)) {
      console.warn(`⚠️ Session ${sessionId} already exists, restarting...`);
      await this.stopSession(sessionId);
    }

    try {
      console.log(`🎬 Starting transcription session: ${sessionId}`);

      const sessionState = {
        sessionId,
        startTime: Date.now(),
        isActive: true,
        
        // Buffer management
        chunkBuffer: [],
        bufferStartTime: Date.now(),
        lastProcessedChunk: null,
        
        // Configuration
        language: options.language || 'en',
        autoDetectLanguage: options.autoDetectLanguage !== false,
        
        // Processing state
        isProcessing: false,
        processingTimeout: null,
        retryCount: 0,
        
        // Statistics
        chunksReceived: 0,
        chunksProcessed: 0,
        lastActivity: Date.now(),
        
        // Event data
        lastTranscription: null,
        transcriptionHistory: []
      };

      this.activeSessions.set(sessionId, sessionState);
      this.stats.totalSessions++;

      // Emit session started event
      this.emit('session:started', {
        sessionId,
        language: sessionState.language,
        timestamp: new Date()
      });

      this.logDebug(`Session started: ${sessionId}`, {
        language: sessionState.language,
        bufferSize: this.config.bufferSize,
        bufferTimeout: this.config.bufferTimeout
      });

      return {
        success: true,
        sessionId,
        language: sessionState.language,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Failed to start session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Process an incoming audio chunk
   * @param {string} sessionId - Conference session identifier
   * @param {Buffer|string} audioData - Audio data chunk
   * @param {Object} metadata - Chunk metadata
   * @returns {Promise<Object>} Processing result
   */
  async processChunk(sessionId, audioData, metadata = {}) {
    if (this.isShuttingDown) {
      throw new Error('TranscriptionAgent is shutting down');
    }

    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateChunkInput(sessionId, audioData, metadata);

      // Get or create session
      let session = this.activeSessions.get(sessionId);
      if (!session) {
        console.log(`🔄 Creating new session for chunk: ${sessionId}`);
        await this.startSession(sessionId, { language: metadata.language });
        session = this.activeSessions.get(sessionId);
      }

      // Validate audio data
      const validation = this.config.asrService.validateAudioFormat(audioData);
      if (!validation.valid) {
        throw new Error(`Invalid audio format: ${validation.errors.join(', ')}`);
      }

      // Create chunk object
      const chunk = {
        audioData,
        chunkId: metadata.chunkId || `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: metadata.timestamp || Date.now(),
        language: metadata.language || session.language,
        userId: metadata.userId,
        size: validation.size,
        receivedAt: Date.now()
      };

      // Add to session buffer
      this.addToBuffer(session, chunk);

      // Update session stats
      session.chunksReceived++;
      session.lastActivity = Date.now();

      console.log(`🎵 Chunk ${chunk.chunkId} added to session ${sessionId} buffer (${session.chunkBuffer.length}/${this.config.bufferSize})`);

      // Check if buffer should be processed
      const shouldProcess = this.shouldProcessBuffer(session);
      if (shouldProcess) {
        await this.processSessionBuffer(sessionId);
      }

      // Set up buffer timeout if needed
      this.setupBufferTimeout(sessionId);

      const processingTime = Date.now() - startTime;
      this.stats.totalChunksProcessed++;

      this.logDebug(`Chunk processed in ${processingTime}ms`, {
        sessionId,
        chunkId: chunk.chunkId,
        bufferLength: session.chunkBuffer.length,
        shouldProcess
      });

      return {
        success: true,
        sessionId,
        chunkId: chunk.chunkId,
        bufferLength: session.chunkBuffer.length,
        processingTime,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Chunk processing failed for session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      
      // Emit error event
      this.emit('chunk:error', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Force process session buffer (for timeout or manual trigger)
   * @param {string} sessionId - Conference session identifier
   * @returns {Promise<Object>} Processing result
   */
  async processSessionBuffer(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    if (session.isProcessing) {
      console.log(`⏳ Session ${sessionId} already processing, skipping...`);
      return { skipped: true, reason: 'already_processing' };
    }

    if (session.chunkBuffer.length === 0) {
      console.log(`📭 Session ${sessionId} buffer is empty, skipping...`);
      return { skipped: true, reason: 'empty_buffer' };
    }

    try {
      console.log(`🔄 Processing buffer for session ${sessionId} (${session.chunkBuffer.length} chunks)`);

      session.isProcessing = true;
      session.retryCount = 0;

      // Clear any existing timeout
      if (session.processingTimeout) {
        clearTimeout(session.processingTimeout);
        session.processingTimeout = null;
      }

      // Take chunks from buffer for processing
      const chunksToProcess = session.chunkBuffer.splice(0, this.config.bufferSize);
      
      // Combine audio data from chunks
      const combinedAudioData = await this.combineAudioChunks(chunksToProcess);
      
      // Update buffer start time
      session.bufferStartTime = Date.now();

      // Process through ASR service
      const transcriptionResult = await this.transcribeAudioData(sessionId, combinedAudioData, {
        language: session.language,
        chunkCount: chunksToProcess.length
      });

      // Update session statistics
      session.chunksProcessed += chunksToProcess.length;
      session.lastTranscription = transcriptionResult;
      session.transcriptionHistory.push(transcriptionResult);

      // Emit partial transcription event
      this.emit('transcription:partial', {
        sessionId,
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration,
        timestamp: new Date(),
        isFinal: transcriptionResult.isFinal,
        chunkCount: chunksToProcess.length,
        processingTime: transcriptionResult.processingTime,
        metadata: transcriptionResult.metadata
      });

      // Update stats
      this.stats.totalTranscriptions++;
      this.updateAverageProcessingTime(transcriptionResult.processingTime);

      console.log(`✅ Buffer processed for session ${sessionId}: "${transcriptionResult.text.substring(0, 50)}..."`);

      return {
        success: true,
        sessionId,
        text: transcriptionResult.text,
        confidence: transcriptionResult.confidence,
        chunkCount: chunksToProcess.length,
        processingTime: transcriptionResult.processingTime,
        isFinal: transcriptionResult.isFinal
      };

    } catch (error) {
      console.error(`❌ Buffer processing failed for session ${sessionId}:`, error.message);
      
      // Handle retry logic
      await this.handleProcessingError(sessionId, error);
      
      // Emit error event
      this.emit('transcription:error', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    } finally {
      session.isProcessing = false;
    }
  }

  /**
   * Stop a transcription session
   * @param {string} sessionId - Conference session identifier
   * @returns {Promise<Object>} Stop result
   */
  async stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ Session ${sessionId} not found for stopping`);
      return { success: false, error: 'Session not found' };
    }

    try {
      console.log(`🛑 Stopping transcription session: ${sessionId}`);

      // Process any remaining chunks in buffer
      if (session.chunkBuffer.length > 0 && !session.isProcessing) {
        try {
          await this.processSessionBuffer(sessionId);
        } catch (error) {
          console.warn(`⚠️ Failed to process final buffer for session ${sessionId}:`, error.message);
        }
      }

      // Calculate session statistics
      const sessionStats = this.calculateSessionStats(session);
      
      // Clean up session
      this.cleanupSession(sessionId);

      // Emit session stopped event
      this.emit('session:stopped', {
        sessionId,
        stats: sessionStats,
        timestamp: new Date()
      });

      console.log(`✅ Session stopped: ${sessionId}`, sessionStats);

      return {
        success: true,
        sessionId,
        stats: sessionStats,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Failed to stop session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Conference session identifier
   * @returns {Object} Session status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        active: false,
        sessionId,
        message: 'Session not found'
      };
    }

    return {
      active: session.isActive,
      sessionId,
      language: session.language,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      bufferLength: session.chunkBuffer.length,
      chunksReceived: session.chunksReceived,
      chunksProcessed: session.chunksProcessed,
      isProcessing: session.isProcessing,
      lastActivity: session.lastActivity,
      lastTranscription: session.lastTranscription ? {
        text: session.lastTranscription.text,
        confidence: session.lastTranscription.confidence,
        timestamp: session.lastTranscription.timestamp
      } : null
    };
  }

  /**
   * Get all active sessions
   * @returns {Array<Object>} Array of session statuses
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...this.getSessionStatus(sessionId)
    }));
  }

  /**
   * Get agent statistics
   * @returns {Object} Agent statistics
   */
  getStats() {
    const activeSessionCount = this.activeSessions.size;
    const uptime = Date.now() - this.stats.startTime;

    return {
      ...this.stats,
      uptime,
      activeSessions: activeSessionCount,
      isInitialized: this.isInitialized,
      isShuttingDown: this.isShuttingDown,
      queueLength: this.processingQueue.length
    };
  }

  /**
   * Shutdown the TranscriptionAgent
   * @returns {Promise<void>}
   */
  async shutdown() {
    console.log('🛑 Shutting down TranscriptionAgent...');
    
    this.isShuttingDown = true;

    try {
      // Stop all active sessions
      const sessionIds = Array.from(this.activeSessions.keys());
      await Promise.all(sessionIds.map(sessionId => this.stopSession(sessionId)));

      // Cleanup ASR service
      if (this.config.asrService) {
        await this.config.asrService.cleanup();
      }

      // Clear processing queue
      this.processingQueue = [];
      this.isProcessingQueue = false;

      this.isInitialized = false;
      console.log('✅ TranscriptionAgent shutdown complete');

    } catch (error) {
      console.error('❌ Error during TranscriptionAgent shutdown:', error.message);
    }
  }

  // Private helper methods

  /**
   * Validate chunk input parameters
   */
  validateChunkInput(sessionId, audioData, metadata) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Valid sessionId is required');
    }

    if (!audioData) {
      throw new Error('Audio data is required');
    }

    if (typeof audioData !== 'string' && !Buffer.isBuffer(audioData)) {
      throw new Error('Audio data must be string (base64) or Buffer');
    }

    const chunkSize = this.config.asrService.getAudioSize(audioData);
    if (chunkSize > this.config.maxChunkSize) {
      throw new Error(`Chunk size ${chunkSize} exceeds maximum ${this.config.maxChunkSize}`);
    }
  }

  /**
   * Add chunk to session buffer
   */
  addToBuffer(session, chunk) {
    session.chunkBuffer.push(chunk);

    // Limit buffer size to prevent memory issues
    if (session.chunkBuffer.length > this.config.maxBufferSize) {
      const removed = session.chunkBuffer.splice(0, session.chunkBuffer.length - this.config.maxBufferSize);
      console.warn(`🗑️ Buffer overflow: removed ${removed.length} old chunks from session ${session.sessionId}`);
    }
  }

  /**
   * Check if buffer should be processed
   */
  shouldProcessBuffer(session) {
    const bufferLength = session.chunkBuffer.length;
    const bufferAge = Date.now() - session.bufferStartTime;
    
    // Process if buffer is full
    if (bufferLength >= this.config.bufferSize) {
      return true;
    }
    
    // Process if buffer timeout exceeded
    if (bufferAge >= this.config.bufferTimeout) {
      return true;
    }
    
    return false;
  }

  /**
   * Set up buffer timeout for session
   */
  setupBufferTimeout(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.isProcessing || session.chunkBuffer.length === 0) {
      return;
    }

    // Clear existing timeout
    if (session.processingTimeout) {
      clearTimeout(session.processingTimeout);
    }

    // Set new timeout
    const timeSinceBufferStart = Date.now() - session.bufferStartTime;
    const remainingTime = Math.max(0, this.config.bufferTimeout - timeSinceBufferStart);

    session.processingTimeout = setTimeout(() => {
      if (session.isActive && session.chunkBuffer.length > 0 && !session.isProcessing) {
        console.log(`⏰ Buffer timeout reached for session ${sessionId}, processing buffer...`);
        this.processSessionBuffer(sessionId).catch(error => {
          console.error(`❌ Timeout processing failed for session ${sessionId}:`, error.message);
        });
      }
    }, remainingTime);
  }

  /**
   * Combine multiple audio chunks into single buffer
   */
  async combineAudioChunks(chunks) {
    if (chunks.length === 1) {
      return chunks[0].audioData;
    }

    // For simplicity, we'll concatenate the audio data
    // In a real implementation, you might want to use proper audio concatenation
    const audioBuffers = chunks.map(chunk => {
      if (typeof chunk.audioData === 'string') {
        return Buffer.from(chunk.audioData, 'base64');
      }
      return chunk.audioData;
    });

    // Combine buffers (this is a simplified approach)
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const combinedBuffer = Buffer.concat(audioBuffers, totalLength);

    return combinedBuffer;
  }

  /**
   * Transcribe combined audio data using ASR service
   */
  async transcribeAudioData(sessionId, audioData, options) {
    const startTime = Date.now();
    const maxRetries = this.config.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎤 Transcribing audio for session ${sessionId} (attempt ${attempt}/${maxRetries})`);

        const result = await this.config.asrService.transcribe(audioData, {
          language: options.language,
          timestamp: true
        });

        result.processingTime = Date.now() - startTime;
        return result;

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Transcription attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Transcription failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Handle processing errors with retry logic
   */
  async handleProcessingError(sessionId, error) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.retryCount++;
    
    if (session.retryCount >= this.config.maxRetries) {
      console.error(`💀 Max retries exceeded for session ${sessionId}, deactivating...`);
      session.isActive = false;
    }
  }

  /**
   * Calculate session statistics
   */
  calculateSessionStats(session) {
    return {
      sessionId: session.sessionId,
      duration: Date.now() - session.startTime,
      chunksReceived: session.chunksReceived,
      chunksProcessed: session.chunksProcessed,
      transcriptions: session.transcriptionHistory.length,
      averageConfidence: session.transcriptionHistory.length > 0 
        ? session.transcriptionHistory.reduce((sum, t) => sum + (t.confidence || 0), 0) / session.transcriptionHistory.length
        : 0,
      totalProcessingTime: session.transcriptionHistory.reduce((sum, t) => sum + (t.processingTime || 0), 0)
    };
  }

  /**
   * Clean up session resources
   */
  cleanupSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.processingTimeout) {
        clearTimeout(session.processingTimeout);
      }
      
      // Clear buffer to free memory
      session.chunkBuffer = [];
      
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Update average processing time statistics
   */
  updateAverageProcessingTime(processingTime) {
    const total = this.stats.averageProcessingTime * (this.stats.totalTranscriptions - 1) + processingTime;
    this.stats.averageProcessingTime = total / this.stats.totalTranscriptions;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Log all events for debugging
    this.on('session:started', (data) => {
      this.logDebug('Session started', data);
    });

    this.on('session:stopped', (data) => {
      this.logDebug('Session stopped', data);
    });

    this.on('transcription:partial', (data) => {
      this.logDebug('Partial transcription', {
        sessionId: data.sessionId,
        textLength: data.text?.length || 0,
        confidence: data.confidence
      });
    });

    this.on('transcription:error', (data) => {
      this.logDebug('Transcription error', data);
    });

    this.on('chunk:error', (data) => {
      this.logDebug('Chunk error', data);
    });
  }

  /**
   * Debug logging
   */
  logDebug(message, data = null) {
    if (this.config.enableDebugLogging) {
      console.log(`[TranscriptionAgent] ${message}`, data ? data : '');
    }
  }
}

export default TranscriptionAgent;
