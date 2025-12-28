/**
 * Streamlined TranscriptionAgent for Real-time Audio Chunk Processing
 * 
 * Focused implementation that:
 * - Accepts small audio chunks (1–3 seconds)
 * - Buffers chunks per session
 * - Sends buffered audio to OpenAI Whisper API
 * - Returns partial transcriptions (real-time style)
 * - Emits "transcription:partial" events
 * 
 * Constraints:
 * - Uses async/await
 * - Does NOT block the main thread
 * - Gracefully handles API failures
 * - Easy to swap Whisper with another ASR later
 */

import { EventEmitter } from 'events';

class TranscriptionAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Core configuration
    this.config = {
      // Buffer settings - optimized for real-time processing
      bufferSize: options.bufferSize || 3, // Process after 3 chunks for faster response
      maxBufferSize: options.maxBufferSize || 6, // Prevent memory issues
      bufferTimeout: options.bufferTimeout || 3000, // 3 seconds max buffer time
      
      // Processing settings
      maxRetries: options.maxRetries || 2, // Reduced retries for faster failure handling
      retryDelay: options.retryDelay || 1000, // 1 second between retries
      
      // Audio settings
      maxChunkSize: options.maxChunkSize || 1024 * 1024, // 1MB
      
      // ASR service (pluggable)
      asrService: options.asrService,
      
      // Debug
      enableDebugLogging: options.enableDebugLogging || false
    };

    if (!this.config.asrService) {
      throw new Error('ASR service is required. Please provide an ASR service instance.');
    }

    // Core state
    this.activeSessions = new Map(); // sessionId -> SessionState
    this.isInitialized = false;

    // Statistics
    this.stats = {
      totalSessions: 0,
      totalChunksProcessed: 0,
      totalTranscriptions: 0,
      errorCount: 0
    };
  }

  /**
   * Initialize the TranscriptionAgent
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    try {
      this.log('Initializing TranscriptionAgent...');
      
      // Initialize ASR service
      const asrInitialized = await this.config.asrService.initialize();
      if (!asrInitialized) {
        throw new Error('Failed to initialize ASR service');
      }

      this.isInitialized = true;
      this.log('TranscriptionAgent initialized successfully');
      return true;
    } catch (error) {
      this.log('Failed to initialize TranscriptionAgent:', error.message);
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
    if (!this.isInitialized) {
      throw new Error('TranscriptionAgent not initialized');
    }

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Clean up existing session if it exists
    if (this.activeSessions.has(sessionId)) {
      await this.stopSession(sessionId);
    }

    try {
      this.log(`Starting transcription session: ${sessionId}`);

      const sessionState = {
        sessionId,
        startTime: Date.now(),
        isActive: true,
        
        // Buffer management
        chunkBuffer: [],
        bufferStartTime: Date.now(),
        
        // Configuration
        language: options.language || 'en',
        autoDetectLanguage: options.autoDetectLanguage !== false,
        
        // Processing state
        isProcessing: false,
        retryCount: 0,
        
        // Statistics
        chunksReceived: 0,
        chunksProcessed: 0,
        lastActivity: Date.now()
      };

      this.activeSessions.set(sessionId, sessionState);
      this.stats.totalSessions++;

      // Emit session started event
      this.emit('session:started', {
        sessionId,
        language: sessionState.language,
        timestamp: new Date()
      });

      this.log(`Session started: ${sessionId}`);

      return {
        success: true,
        sessionId,
        language: sessionState.language,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Failed to start session ${sessionId}:`, error.message);
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
    if (!this.isInitialized) {
      throw new Error('TranscriptionAgent not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateChunkInput(sessionId, audioData, metadata);

      // Get or create session
      let session = this.activeSessions.get(sessionId);
      if (!session) {
        this.log(`Creating new session for chunk: ${sessionId}`);
        await this.startSession(sessionId, { language: metadata.language });
        session = this.activeSessions.get(sessionId);
      }

      if (!session.isActive) {
        throw new Error(`Session ${sessionId} is not active`);
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
        size: validation.size
      };

      // Add to session buffer
      this.addToBuffer(session, chunk);

      // Update session stats
      session.chunksReceived++;
      session.lastActivity = Date.now();

      this.log(`Chunk ${chunk.chunkId} added to session ${sessionId} buffer (${session.chunkBuffer.length}/${this.config.bufferSize})`);

      // Check if buffer should be processed immediately
      const shouldProcess = this.shouldProcessBuffer(session);
      if (shouldProcess) {
        // Process asynchronously to avoid blocking
        this.processSessionBuffer(sessionId).catch(error => {
          this.log(`Async buffer processing failed for session ${sessionId}:`, error.message);
        });
      }

      // Set up buffer timeout
      this.setupBufferTimeout(sessionId);

      const processingTime = Date.now() - startTime;
      this.stats.totalChunksProcessed++;

      this.log(`Chunk processed in ${processingTime}ms`);

      return {
        success: true,
        sessionId,
        chunkId: chunk.chunkId,
        bufferLength: session.chunkBuffer.length,
        processingTime,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Chunk processing failed for session ${sessionId}:`, error.message);
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
   * Process session buffer (async, non-blocking)
   * @param {string} sessionId - Conference session identifier
   * @returns {Promise<Object>} Processing result
   */
  async processSessionBuffer(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    if (session.isProcessing) {
      this.log(`Session ${sessionId} already processing, skipping...`);
      return { skipped: true, reason: 'already_processing' };
    }

    if (session.chunkBuffer.length === 0) {
      return { skipped: true, reason: 'empty_buffer' };
    }

    try {
      this.log(`Processing buffer for session ${sessionId} (${session.chunkBuffer.length} chunks)`);

      session.isProcessing = true;
      session.retryCount = 0;

      // Take chunks from buffer for processing
      const chunksToProcess = session.chunkBuffer.splice(0, this.config.bufferSize);
      
      // Combine audio data from chunks
      const combinedAudioData = await this.combineAudioChunks(chunksToProcess);
      
      // Update buffer start time
      session.bufferStartTime = Date.now();

      // Process through ASR service with retry logic
      const transcriptionResult = await this.transcribeWithRetry(sessionId, combinedAudioData, {
        language: session.language,
        chunkCount: chunksToProcess.length
      });

      // Update session statistics
      session.chunksProcessed += chunksToProcess.length;

      // Emit partial transcription event (the key requirement)
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

      this.log(`Buffer processed for session ${sessionId}: "${transcriptionResult.text.substring(0, 50)}..."`);

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
      this.log(`Buffer processing failed for session ${sessionId}:`, error.message);
      
      // Handle retry logic
      session.retryCount++;
      if (session.retryCount >= this.config.maxRetries) {
        this.log(`Max retries exceeded for session ${sessionId}, deactivating...`);
        session.isActive = false;
      }
      
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
      this.log(`Session ${sessionId} not found for stopping`);
      return { success: false, error: 'Session not found' };
    }

    try {
      this.log(`Stopping transcription session: ${sessionId}`);

      // Process any remaining chunks in buffer
      if (session.chunkBuffer.length > 0 && !session.isProcessing) {
        try {
          await this.processSessionBuffer(sessionId);
        } catch (error) {
          this.log(`Failed to process final buffer for session ${sessionId}:`, error.message);
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

      this.log(`Session stopped: ${sessionId}`, sessionStats);

      return {
        success: true,
        sessionId,
        stats: sessionStats,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Failed to stop session ${sessionId}:`, error.message);
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
      lastActivity: session.lastActivity
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

    return {
      ...this.stats,
      activeSessions: activeSessionCount,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Shutdown the TranscriptionAgent
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.log('Shutting down TranscriptionAgent...');

    try {
      // Stop all active sessions
      const sessionIds = Array.from(this.activeSessions.keys());
      await Promise.all(sessionIds.map(sessionId => this.stopSession(sessionId)));

      // Cleanup ASR service
      if (this.config.asrService) {
        await this.config.asrService.cleanup();
      }

      this.isInitialized = false;
      this.log('TranscriptionAgent shutdown complete');

    } catch (error) {
      this.log('Error during TranscriptionAgent shutdown:', error.message);
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
      this.log(`Buffer overflow: removed ${removed.length} old chunks from session ${session.sessionId}`);
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

    // Clear existing timeout and set new one
    const timeSinceBufferStart = Date.now() - session.bufferStartTime;
    const remainingTime = Math.max(0, this.config.bufferTimeout - timeSinceBufferStart);

    setTimeout(() => {
      if (session.isActive && session.chunkBuffer.length > 0 && !session.isProcessing) {
        this.log(`Buffer timeout reached for session ${sessionId}, processing buffer...`);
        this.processSessionBuffer(sessionId).catch(error => {
          this.log(`Timeout processing failed for session ${sessionId}:`, error.message);
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

    // Simple concatenation - in production, you might want proper audio mixing
    const audioBuffers = chunks.map(chunk => {
      if (typeof chunk.audioData === 'string') {
        return Buffer.from(chunk.audioData, 'base64');
      }
      return chunk.audioData;
    });

    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    return Buffer.concat(audioBuffers, totalLength);
  }

  /**
   * Transcribe with retry logic
   */
  async transcribeWithRetry(sessionId, audioData, options) {
    const startTime = Date.now();
    const maxRetries = this.config.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`Transcribing audio for session ${sessionId} (attempt ${attempt}/${maxRetries})`);

        const result = await this.config.asrService.transcribe(audioData, {
          language: options.language,
          timestamp: true
        });

        result.processingTime = Date.now() - startTime;
        return result;

      } catch (error) {
        lastError = error;
        this.log(`Transcription attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    throw new Error(`Transcription failed after ${maxRetries} attempts: ${lastError.message}`);
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
      totalProcessingTime: 0 // Could be enhanced to track actual processing time
    };
  }

  /**
   * Clean up session resources
   */
  cleanupSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Clear buffer to free memory
      session.chunkBuffer = [];
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Debug logging
   */
  log(message, data = null) {
    if (this.config.enableDebugLogging) {
      console.log(`[TranscriptionAgent] ${message}`, data ? data : '');
    }
  }
}

export default TranscriptionAgent;
