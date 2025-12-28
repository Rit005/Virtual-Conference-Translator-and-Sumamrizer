import { io } from 'socket.io-client';
import { WS_BASE_URL, CONFERENCE_CONSTANTS } from '../utils/constants.js';
import ReconnectionManager from '../utils/reconnectionManager.js';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.currentSessionId = null;
    this.currentUserId = null;
    
    // Latency tracking for live captions
    this.captionLatencies = new Map();
    this.averageLatency = 0;
    this.lastCaptionTime = null;
    
    // Production-grade error handling
    this.reconnectionManager = new ReconnectionManager();
    this.audioChunkRateLimiter = {
      chunks: [],
      maxChunks: 10, // Max 10 chunks per second
      windowMs: 1000
    };
    this.messageRateLimiter = {
      messages: [],
      maxMessages: 50, // Max 50 messages per second
      windowMs: 1000
    };
    this.errorLog = [];
    this.maxErrorLogEntries = 100;
    
    // Setup reconnection manager callbacks
    this.setupReconnectionHandlers();
  }

  /**
   * Setup reconnection manager event handlers
   */
  setupReconnectionHandlers() {
    this.reconnectionManager.on('connected', (data) => {
      console.log(`✅ WebSocket reconnected successfully`, {
        connectionId: data.connectionId,
        sessionId: data.sessionId,
        userId: data.userId
      });
      this.isConnected = true;
      this.emit('connectionStatus', { 
        connected: true, 
        connectionId: data.connectionId,
        sessionId: data.sessionId 
      });
    });

    this.reconnectionManager.on('disconnected', (data) => {
      console.log(`❌ WebSocket disconnected`, {
        connectionId: data.connectionId,
        sessionId: data.sessionId,
        userId: data.userId,
        reason: data.reason
      });
      this.isConnected = false;
      this.emit('connectionStatus', { 
        connected: false, 
        reason: data.reason,
        sessionId: data.sessionId 
      });
    });

    this.reconnectionManager.on('reconnecting', (data) => {
      console.log(`🔄 WebSocket reconnecting (attempt ${data.attempt}/${data.maxAttempts})`, {
        connectionId: data.connectionId,
        delay: data.delay
      });
      this.emit('reconnecting', data);
    });

    this.reconnectionManager.on('reconnected', (data) => {
      console.log(`✅ WebSocket reconnected after ${data.attempt} attempts`, {
        connectionId: data.connectionId,
        reconnectTime: data.reconnectTime
      });
      this.emit('reconnected', data);
    });

    this.reconnectionManager.on('reconnection_failed', (data) => {
      console.warn(`⚠️ WebSocket reconnection attempt ${data.attempt} failed`, {
        connectionId: data.connectionId,
        error: data.error
      });
      this.emit('reconnection_failed', data);
    });

    this.reconnectionManager.on('reconnection_exhausted', (data) => {
      console.error(`❌ WebSocket reconnection exhausted after ${data.totalAttempts} attempts`, {
        connectionId: data.connectionId,
        sessionId: data.sessionId
      });
      this.emit('reconnection_exhausted', data);
    });
  }

  // Connect to WebSocket server with enhanced error handling
  connect(sessionId, userId) {
    try {
      // Prevent duplicate connections
      if (this.isConnected && this.currentSessionId === sessionId && this.currentUserId === userId) {
        console.log(`⚠️ Already connected to session ${sessionId} as user ${userId}`);
        return this.socket;
      }

      console.log(`🔌 Connecting to WebSocket for session: ${sessionId}, user: ${userId}`);
      
      this.currentSessionId = sessionId;
      this.currentUserId = userId;

      // Update reconnection manager with session context
      this.reconnectionManager.updateConnectionState(false, { 
        sessionId, 
        userId, 
        reason: 'connecting' 
      });

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.socket = io(WS_BASE_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        timeout: 10000, // 10 second connection timeout
        reconnection: false // We handle reconnection manually
      });

      this.socket.on('connect', () => {
        console.log(`✅ WebSocket connected for session ${sessionId}, user ${userId}`, {
          connectionId: this.reconnectionManager.connectionId,
          socketId: this.socket.id
        });
        
        this.isConnected = true;
        this.reconnectionManager.updateConnectionState(true, { 
          sessionId, 
          userId, 
          socketId: this.socket.id 
        });
        
        // Authenticate with JWT token
        this.authenticate();
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`❌ WebSocket disconnected from session ${sessionId}`, {
          connectionId: this.reconnectionManager.connectionId,
          reason,
          userId
        });
        
        this.isConnected = false;
        this.reconnectionManager.updateConnectionState(false, { 
          sessionId, 
          userId, 
          reason 
        });
        
        this.emit('connectionStatus', { 
          connected: false, 
          reason,
          sessionId 
        });
      });

      this.socket.on('error', (error) => {
        this.logError('WebSocket connection error', {
          error: error.message,
          sessionId,
          userId,
          connectionId: this.reconnectionManager.connectionId
        });
        
        this.emit('error', {
          ...error,
          sessionId,
          userId,
          context: 'websocket_connection'
        });
      });

      this.socket.on('connect_error', (error) => {
        this.logError('WebSocket connection failed', {
          error: error.message,
          sessionId,
          userId,
          connectionId: this.reconnectionManager.connectionId,
          description: error.description
        });
        
        this.reconnectionManager.updateConnectionState(false, { 
          sessionId, 
          userId, 
          reason: `connect_error: ${error.message}` 
        });
      });

      // Handle authentication events
      this.socket.on('authenticated', (data) => {
        console.log('✅ Authentication successful:', data);
        // After authentication, join the session
        this.joinSession(sessionId);
      });

      this.socket.on('authentication_error', (error) => {
        console.error('❌ Authentication failed:', error);
        this.emit('error', { message: 'Authentication failed', error });
      });

      // Handle session events
      this.socket.on('session_joined', (data) => {
        console.log('✅ Session joined:', data);
        this.emit('sessionJoined', data);
      });

      this.socket.on('session_left', (data) => {
        console.log('👋 Session left:', data);
        this.emit('sessionLeft', data);
      });

      // Handle live captions with latency tracking
      this.socket.on('caption:update', (caption) => {
        console.log('🎬 New live caption:', caption);
        
        // Calculate latency if timestamp is provided
        const currentTime = Date.now();
        const captionTime = caption.timestamp || currentTime;
        const latency = currentTime - captionTime;
        
        // Track latency for this caption
        if (caption.id) {
          this.captionLatencies.set(caption.id, latency);
          this.updateAverageLatency();
        }
        
        // Add latency info to caption object
        const captionWithLatency = {
          ...caption,
          latency,
          latencyStatus: this.getLatencyStatus(latency),
          receivedAt: currentTime
        };
        
        this.emit('liveCaption', captionWithLatency);
        this.lastCaptionTime = currentTime;
      });

      this.socket.on('live_captions_started', (data) => {
        console.log('🎬 Live captions started:', data);
        this.emit('liveCaptionsStarted', data);
      });

      this.socket.on('live_captions_stopped', (data) => {
        console.log('🛑 Live captions stopped:', data);
        this.emit('liveCaptionsStopped', data);
      });

      // Handle chat messages
      this.socket.on('new_message', (message) => {
        console.log('💬 New chat message:', message);
        this.emit('chatMessage', message);
      });

      // Handle summary updates
      this.socket.on('summary_update', (update) => {
        console.log('📝 Summary update:', update);
        this.emit('summaryUpdate', update);
      });

      // Handle session lifecycle
      this.socket.on('session_started', (data) => {
        console.log('🚀 Session started:', data);
        this.emit('sessionStarted', data);
      });

      this.socket.on('session_ended', (data) => {
        console.log('🏁 Session ended:', data);
        this.emit('sessionEnded', data);
      });

      // Handle participant events
      this.socket.on('user_joined', (data) => {
        console.log('👤 User joined:', data);
        this.emit('userJoined', data);
      });

      this.socket.on('user_left', (data) => {
        console.log('👋 User left:', data);
        this.emit('userLeft', data);
      });

      // Handle typing indicators
      this.socket.on('user_typing', (data) => {
        this.emit('userTyping', data);
      });

      this.socket.on('user_stopped_typing', (data) => {
        this.emit('userStoppedTyping', data);
      });

      // Handle participant count updates
      this.socket.on('participant_count_update', (data) => {
        console.log('👥 Participant count updated:', data);
        this.emit('participant_count_update', data);
      });

      // Handle Q&A events
      this.socket.on('message_updated', (data) => {
        console.log('📝 Message updated:', data);
        this.emit('message_updated', data);
      });

      this.socket.on('pinned_questions', (data) => {
        console.log('📌 Pinned questions received:', data);
        this.emit('pinned_questions', data);
      });

      return this.socket;
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.emit('error', error);
      return null;
    }
  }

  // Authenticate with JWT token
  authenticate() {
    const token = localStorage.getItem('token');
    if (token && this.socket) {
      console.log('🔐 Authenticating with token...');
      this.socket.emit('authenticate', { token });
    } else {
      console.warn('⚠️ No authentication token found');
      this.emit('error', { message: 'No authentication token' });
    }
  }

  // Join a conference session
  joinSession(sessionId) {
    if (this.socket && this.isConnected) {
      console.log(`🏠 Joining session: ${sessionId}`);
      this.socket.emit('join_session', { sessionId });
    }
  }

  // Leave the current session
  leaveSession() {
    if (this.socket && this.currentSessionId) {
      console.log(`🚪 Leaving session: ${this.currentSessionId}`);
      this.socket.emit('leave_session', { sessionId: this.currentSessionId });
    }
  }

  // Disconnect from WebSocket server with enhanced cleanup
  disconnect() {
    console.log(`🔌 Disconnecting WebSocket for session ${this.currentSessionId}, user ${this.currentUserId}`, {
      connectionId: this.reconnectionManager.connectionId
    });
    
    // Update reconnection manager
    this.reconnectionManager.updateConnectionState(false, { 
      sessionId: this.currentSessionId, 
      userId: this.currentUserId, 
      reason: 'manual_disconnect' 
    });

    // Leave current session before disconnecting
    if (this.currentSessionId && this.isConnected) {
      this.leaveSession();
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.listeners.clear();
    this.currentSessionId = null;
    this.currentUserId = null;
    
    // Clear rate limiting data
    this.audioChunkRateLimiter.chunks = [];
    this.messageRateLimiter.messages = [];
    
    console.log(`✅ WebSocket disconnected successfully`);
  }

  // Reconnect with existing session context
  reconnect() {
    if (this.currentSessionId && this.currentUserId) {
      console.log(`🔄 Manually reconnecting to session ${this.currentSessionId}`, {
        connectionId: this.reconnectionManager.connectionId
      });
      
      return this.reconnectionManager.manualReconnect(() => {
        return new Promise((resolve) => {
          try {
            this.connect(this.currentSessionId, this.currentUserId);
            // Give it a moment to establish connection
            setTimeout(() => {
              resolve(this.isConnected);
            }, 1000);
          } catch (error) {
            console.error('Manual reconnection failed:', error);
            resolve(false);
          }
        });
      });
    } else {
      console.warn('⚠️ Cannot reconnect: missing session or user context');
      return Promise.resolve(false);
    }
  }

  // Force reconnection with new session
  forceReconnect(newSessionId, newUserId) {
    console.log(`🔄 Force reconnecting to new session ${newSessionId}`, {
      oldSessionId: this.currentSessionId,
      oldUserId: this.currentUserId,
      newSessionId,
      newUserId,
      connectionId: this.reconnectionManager.connectionId
    });
    
    // Disconnect current connection
    this.disconnect();
    
    // Reset reconnection manager
    this.reconnectionManager.reset();
    
    // Connect to new session
    setTimeout(() => {
      this.connect(newSessionId, newUserId);
    }, 100);
  }

  // Send message
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Also listen to socket events
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Unsubscribe from events
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Emit event to listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Start live captions for a session
  startLiveCaptions(sessionId, language = 'en') {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🎬 Starting live captions for session: ${sessionId}`);
      this.socket.emit('start_live_captions', { sessionId, language });
    }
  }

  // Stop live captions for a session
  stopLiveCaptions(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🛑 Stopping live captions for session: ${sessionId}`);
      this.socket.emit('stop_live_captions', { sessionId });
    }
  }

  // Send chat message
  sendChatMessage(text, userId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`💬 Sending chat message: ${text}`);
      this.socket.emit('chat_message', { 
        sessionId, 
        text 
      });
    }
  }

  // Start typing indicator
  startTyping(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      this.socket.emit('typing_start', { sessionId });
    }
  }

  // Stop typing indicator
  stopTyping(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      this.socket.emit('typing_stop', { sessionId });
    }
  }

  // Start a session (host only)
  startSession(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🚀 Starting session: ${sessionId}`);
      this.socket.emit('start_session', { sessionId });
    }
  }

  // End a session (host only)
  endSession(sessionId, generateSummary = true) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🏁 Ending session: ${sessionId}`);
      this.socket.emit('end_session', { sessionId, generateSummary });
    }
  }

  // Request summary
  requestSummary(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`📝 Requesting summary for session: ${sessionId}`);
      this.socket.emit('request_summary', { sessionId });
    }
  }

  // Translate a caption
  translateCaption(sessionId, captionText, sourceLanguage, targetLanguage, userId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🔄 Requesting translation: "${captionText}" from ${sourceLanguage} to ${targetLanguage}`);
      this.socket.emit('translate_caption', {
        sessionId,
        captionText,
        sourceLanguage,
        targetLanguage,
        userId
      });
    }
  }

  // Update language preference
  updateLanguagePreference(sessionId, language) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🌐 Updating language preference to: ${language}`);
      this.socket.emit('update_language_preference', {
        sessionId,
        language
      });
    }
  }

  // Mark message as question
  markAsQuestion(messageId, questionCategory, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`❓ Marking message as question: ${messageId}`);
      this.socket.emit('mark_as_question', {
        messageId,
        questionCategory
      });
    }
  }

  // Unmark message as question
  unmarkAsQuestion(messageId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`❓ Unmarking message as question: ${messageId}`);
      this.socket.emit('unmark_as_question', {
        messageId
      });
    }
  }

  // Pin question (moderator only)
  pinQuestion(messageId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`📌 Pinning question: ${messageId}`);
      this.socket.emit('pin_question', {
        messageId
      });
    }
  }

  // Unpin question (moderator only)
  unpinQuestion(messageId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`📌 Unpinning question: ${messageId}`);
      this.socket.emit('unpin_question', {
        messageId
      });
    }
  }

  // Get pinned questions
  getPinnedQuestions(sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`📌 Getting pinned questions for session: ${sessionId}`);
      this.socket.emit('get_pinned_questions', {
        sessionId
      });
    }
  }

  // Like message
  likeMessage(messageId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`❤️ Liking message: ${messageId}`);
      this.socket.emit('like_message', {
        messageId
      });
    }
  }

  // Send audio chunk for transcription with rate limiting
  sendAudioChunk(sessionId, audioData, language = 'en') {
    // Check if we should send based on rate limiting
    if (!this.checkAudioChunkRateLimit(sessionId)) {
      console.warn(`⚠️ Audio chunk rate limit exceeded for session ${sessionId}`, {
        sessionId,
        userId: this.currentUserId,
        connectionId: this.reconnectionManager.connectionId,
        chunksSent: this.audioChunkRateLimiter.chunks.length,
        maxChunks: this.audioChunkRateLimiter.maxChunks
      });
      return false;
    }

    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🎤 Sending audio chunk to session ${sessionId}:`, {
        dataSize: audioData?.length || audioData?.size,
        language,
        chunkId,
        sessionId,
        userId: this.currentUserId,
        connectionId: this.reconnectionManager.connectionId,
        timestamp: new Date().toISOString()
      });
      
      this.socket.emit('audio:chunk', { 
        sessionId, 
        audioData, 
        language,
        timestamp: Date.now(),
        chunkId,
        userId: this.currentUserId,
        connectionId: this.reconnectionManager.connectionId
      });
      
      // Record this chunk for rate limiting
      this.recordAudioChunk(sessionId);
      return true;
    } else {
      this.logError('Cannot send audio chunk', {
        sessionId,
        currentSessionId: this.currentSessionId,
        isConnected: this.isConnected,
        socketExists: !!this.socket,
        userId: this.currentUserId,
        connectionId: this.reconnectionManager.connectionId
      });
      return false;
    }
  }

  /**
   * Check if audio chunk can be sent based on rate limits
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Whether chunk can be sent
   */
  checkAudioChunkRateLimit(sessionId) {
    const now = Date.now();
    const windowStart = now - this.audioChunkRateLimiter.windowMs;
    
    // Clean up old entries
    this.audioChunkRateLimiter.chunks = this.audioChunkRateLimiter.chunks.filter(
      timestamp => timestamp > windowStart
    );
    
    // Check if we're under the limit
    return this.audioChunkRateLimiter.chunks.length < this.audioChunkRateLimiter.maxChunks;
  }

  /**
   * Record audio chunk for rate limiting
   * @param {string} sessionId - Session identifier
   */
  recordAudioChunk(sessionId) {
    const now = Date.now();
    this.audioChunkRateLimiter.chunks.push(now);
    
    // Keep only chunks from the current window
    const windowStart = now - this.audioChunkRateLimiter.windowMs;
    this.audioChunkRateLimiter.chunks = this.audioChunkRateLimiter.chunks.filter(
      timestamp => timestamp > windowStart
    );
  }

  /**
   * Check if message can be sent based on rate limits
   * @param {string} event - Event type
   * @returns {boolean} Whether message can be sent
   */
  checkMessageRateLimit(event) {
    const now = Date.now();
    const windowStart = now - this.messageRateLimiter.windowMs;
    
    // Clean up old entries
    this.messageRateLimiter.messages = this.messageRateLimiter.messages.filter(
      msg => msg.timestamp > windowStart
    );
    
    // Check if we're under the limit
    return this.messageRateLimiter.messages.length < this.messageRateLimiter.maxMessages;
  }

  /**
   * Record message for rate limiting
   * @param {string} event - Event type
   * @param {Object} data - Message data
   */
  recordMessage(event, data) {
    const now = Date.now();
    this.messageRateLimiter.messages.push({
      timestamp: now,
      event,
      data
    });
    
    // Keep only messages from the current window
    const windowStart = now - this.messageRateLimiter.windowMs;
    this.messageRateLimiter.messages = this.messageRateLimiter.messages.filter(
      msg => msg.timestamp > windowStart
    );
  }

  /**
   * Log error with session context
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   */
  logError(message, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      message,
      context: {
        sessionId: this.currentSessionId,
        userId: this.currentUserId,
        connectionId: this.reconnectionManager.connectionId,
        isConnected: this.isConnected,
        ...context
      }
    };
    
    this.errorLog.push(errorEntry);
    
    // Keep only the last maxErrorLogEntries
    if (this.errorLog.length > this.maxErrorLogEntries) {
      this.errorLog = this.errorLog.slice(-this.maxErrorLogEntries);
    }
    
    console.error(`❌ ${message}:`, errorEntry);
  }

  /**
   * Get error log for debugging
   * @returns {Array} Error log entries
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * Get rate limiting statistics
   * @returns {Object} Rate limiting stats
   */
  getRateLimitStats() {
    const now = Date.now();
    const windowStart = now - this.audioChunkRateLimiter.windowMs;
    
    const recentAudioChunks = this.audioChunkRateLimiter.chunks.filter(
      timestamp => timestamp > windowStart
    ).length;
    
    const recentMessages = this.messageRateLimiter.messages.filter(
      msg => msg.timestamp > windowStart
    ).length;
    
    return {
      audioChunks: {
        sent: recentAudioChunks,
        limit: this.audioChunkRateLimiter.maxChunks,
        windowMs: this.audioChunkRateLimiter.windowMs
      },
      messages: {
        sent: recentMessages,
        limit: this.messageRateLimiter.maxMessages,
        windowMs: this.messageRateLimiter.windowMs
      }
    };
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }

  // Get current session info
  getCurrentSession() {
    return {
      sessionId: this.currentSessionId,
      userId: this.currentUserId,
      isConnected: this.isConnected
    };
  }

  // Reconnect with existing session
  reconnect() {
    if (this.currentSessionId && this.currentUserId) {
      console.log(`🔄 Reconnecting to session: ${this.currentSessionId}`);
      this.connect(this.currentSessionId, this.currentUserId);
    }
  }

  // Get latency status based on threshold
  getLatencyStatus(latency) {
    const thresholds = CONFERENCE_CONSTANTS.LATENCY_STATUS;
    
    if (latency < CONFERENCE_CONSTANTS.EXCELLENT_LATENCY_MS) {
      return thresholds.EXCELLENT;
    } else if (latency < CONFERENCE_CONSTANTS.GOOD_LATENCY_MS) {
      return thresholds.GOOD;
    } else if (latency < CONFERENCE_CONSTANTS.TARGET_LATENCY_MS) {
      return thresholds.NORMAL;
    } else if (latency < 5000) {
      return thresholds.POOR;
    } else {
      return thresholds.BAD;
    }
  }

  // Update average latency calculation
  updateAverageLatency() {
    if (this.captionLatencies.size === 0) return;
    
    const latencies = Array.from(this.captionLatencies.values());
    const sum = latencies.reduce((acc, latency) => acc + latency, 0);
    this.averageLatency = Math.round(sum / latencies.length);
    
    // Clean up old latency entries (keep only last 100)
    if (this.captionLatencies.size > 100) {
      const entries = Array.from(this.captionLatencies.entries());
      const recentEntries = entries.slice(-100);
      this.captionLatencies.clear();
      recentEntries.forEach(([id, latency]) => {
        this.captionLatencies.set(id, latency);
      });
    }
  }

  // Get current latency metrics
  getLatencyMetrics() {
    return {
      average: this.averageLatency,
      lastCaption: this.lastCaptionTime ? Date.now() - this.lastCaptionTime : null,
      status: this.getLatencyStatus(this.averageLatency),
      totalTracked: this.captionLatencies.size
    };
  }

  // Get latency color for UI indicators
  getLatencyColor(latency) {
    if (latency < CONFERENCE_CONSTANTS.EXCELLENT_LATENCY_MS) {
      return 'text-green-500'; // Excellent
    } else if (latency < CONFERENCE_CONSTANTS.GOOD_LATENCY_MS) {
      return 'text-blue-500'; // Good
    } else if (latency < CONFERENCE_CONSTANTS.TARGET_LATENCY_MS) {
      return 'text-yellow-500'; // Normal
    } else if (latency < 5000) {
      return 'text-orange-500'; // Poor
    } else {
      return 'text-red-500'; // Bad
    }
  }

  // Clean up intervals and listeners
  cleanup() {
    // Clear any existing intervals
    if (this.captionInterval) {
      clearInterval(this.captionInterval);
      this.captionInterval = null;
    }
    
    if (this.chatInterval) {
      clearInterval(this.chatInterval);
      this.chatInterval = null;
    }

    // Clear latency tracking
    this.captionLatencies.clear();
    this.averageLatency = 0;
    this.lastCaptionTime = null;

    // Clear all listeners
    this.listeners.clear();
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
