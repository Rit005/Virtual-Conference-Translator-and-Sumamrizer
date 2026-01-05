import { io } from 'socket.io-client';
import { WS_BASE_URL, CONFERENCE_CONSTANTS } from '../utils/constants.js';
import EnhancedReconnectionManager from '../utils/enhancedReconnectionManager.js';
import ListenerManager from '../utils/listenerManager.js';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentSessionId = null;
    this.currentUserId = null;

    this.listenerManager = new ListenerManager();

    this.reconnectionManager = new EnhancedReconnectionManager({
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10
    });

    this.captionLatencies = new Map();
    this.averageLatency = 0;
    this.lastCaptionTime = null;

    this.audioChunkRateLimiter = { chunks: [], maxChunks: 10, windowMs: 1000 };
    this.messageRateLimiter = { messages: [], maxMessages: 50, windowMs: 1000 };

    this.setupReconnectionHandlers();
  }

  /* ------------------------------------------------------------------ */
  /* RECONNECTION HANDLERS                                              */
  /* ------------------------------------------------------------------ */

  setupReconnectionHandlers() {
    this.reconnectionManager.on('connected', () => {
      this.isConnected = true;
      this.emit('connectionStatus', { connected: true });
    });

    this.reconnectionManager.on('disconnected', (data) => {
      this.isConnected = false;
      this.emit('connectionStatus', { connected: false, reason: data?.reason });
    });

    this.reconnectionManager.on('health_check_failed', (data) => {
      this.emit('connection_health_degraded', data);
    });
  }

  /* ------------------------------------------------------------------ */
  /* CONNECTION                                                         */
  /* ------------------------------------------------------------------ */

  connect(sessionId, userId) {
    if (this.isConnected) return;

    this.currentSessionId = sessionId;
    this.currentUserId = userId;

    this.socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: false
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.authenticate();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.emit('connectionStatus', { connected: false, reason });
    });

    this.socket.on('authenticated', () => {
      this.joinSession(sessionId);
    });

    /* ---------------- SOCKET EVENTS ---------------- */

    this.socket.on('caption:update', (data) => this.emit('liveCaption', data));
    this.socket.on('chat_message', (data) => this.emit('chatMessage', data));
    this.socket.on('summary_update', (data) => this.emit('summaryUpdate', data));
    this.socket.on('session_started', (data) => this.emit('sessionStarted', data));
    this.socket.on('session_ended', (data) => this.emit('sessionEnded', data));
    this.socket.on('participant_count_update', (data) =>
      this.emit('participant_count_update', data)
    );
  }

  authenticate() {
    const token = localStorage.getItem('token');
    if (token && this.socket) {
      this.socket.emit('authenticate', { token });
    }
  }

  joinSession(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_session', { sessionId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.currentSessionId = null;
    this.currentUserId = null;

    if (this.listenerManager) {
      this.listenerManager.cleanup();
    }

    this.audioChunkRateLimiter.chunks = [];
    this.messageRateLimiter.messages = [];
  }

  /* ------------------------------------------------------------------ */
  /* LISTENER MANAGEMENT (FIXED)                                        */
  /* ------------------------------------------------------------------ */

  on(event, callback) {
    if (!this.listenerManager) return null;

    const id = this.listenerManager.addListener(event, callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return id;
  }

  off(event, callback = null, listenerId = null) {
    if (!this.listenerManager) return;

    try {
      if (listenerId) {
        this.listenerManager.removeListenerById(listenerId);
      } else if (callback) {
        this.listenerManager.removeListenerByCallback(event, callback);
      }
    } catch (err) {
      console.warn('Listener removal failed', err);
    }

    if (this.socket && callback) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (!this.listenerManager?.getListeners) return 0;

    const listeners = this.listenerManager.getListeners(event) || [];

    for (const listener of listeners) {
      try {
        listener.callback(data);
      } catch (err) {
        console.error(`Listener error (${event})`, err);
      }
    }

    return listeners.length;
  }

  /* ------------------------------------------------------------------ */
  /* ACTIONS                                                            */
  /* ------------------------------------------------------------------ */


  sendAudioChunk(sessionId, audio) {
    if (!this.socket || !this.isConnected) return;
  
    this.socket.emit("audio_chunk", {
      sessionId,
      audio
    });
  }
  
  
  sendChatMessage(text, userId, sessionId) {
    if (this.socket && this.isConnected && this.currentSessionId === sessionId) {
      this.socket.emit('chat_message', { sessionId, text });
    }
  }

  startLiveCaptions(sessionId, language = 'en') {
    if (this.socket && this.isConnected) {
      this.socket.emit('start_live_captions', { sessionId, language });
    }
  }

  stopLiveCaptions(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_live_captions', { sessionId });
    }
  }

  startSession(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('start_session', { sessionId });
    }
  }

  endSession(sessionId, generateSummary = true) {
    if (this.socket && this.isConnected) {
      this.socket.emit('end_session', { sessionId, generateSummary });
    }
  }

  requestSummary(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('request_summary', { sessionId });
    }
  }

  /* ------------------------------------------------------------------ */
  /* UTILITIES                                                          */
  /* ------------------------------------------------------------------ */

  getConnectionStatus() {
    return this.isConnected;
  }

  cleanup() {
    this.disconnect();
    this.captionLatencies.clear();
    this.averageLatency = 0;
  }
}

/* ------------------------------------------------------------------ */
/* SINGLETON EXPORT                                                    */
/* ------------------------------------------------------------------ */

const websocketService = new WebSocketService();
export default websocketService;
