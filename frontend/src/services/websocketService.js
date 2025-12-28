import { io } from 'socket.io-client';
import { WS_BASE_URL, CONFERENCE_CONSTANTS } from '../utils/constants.js';

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
  }

  // Connect to WebSocket server
  connect(sessionId, userId) {
    try {
      console.log(`🔌 Connecting to WebSocket for session: ${sessionId}, user: ${userId}`);
      
      this.currentSessionId = sessionId;
      this.currentUserId = userId;
      
      this.socket = io(WS_BASE_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.emit('connectionStatus', { connected: true });
        
        // Authenticate with JWT token
        this.authenticate();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
        this.isConnected = false;
        this.emit('connectionStatus', { connected: false });
      });

      this.socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
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

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      // Leave current session before disconnecting
      this.leaveSession();
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    this.listeners.clear();
    this.currentSessionId = null;
    this.currentUserId = null;
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

  // Send audio chunk for transcription
  sendAudioChunk(sessionId, audioData, language = 'en') {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      console.log(`🎤 Sending audio chunk to session ${sessionId}:`, {
        dataSize: audioData?.length || audioData?.size,
        language,
        timestamp: new Date().toISOString()
      });
      
      this.socket.emit('audio:chunk', { 
        sessionId, 
        audioData, 
        language,
        timestamp: Date.now(),
        chunkId: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    } else {
      console.warn('⚠️ Cannot send audio chunk: WebSocket not connected or session mismatch');
    }
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
