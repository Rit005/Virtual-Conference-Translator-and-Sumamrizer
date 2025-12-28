/**
 * ReconnectionManager - Frontend production-grade reconnection management
 * Handles WebSocket reconnection, connection state tracking, and error recovery
 */

class ReconnectionManager {
  constructor(options = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.initialReconnectDelay = options.initialReconnectDelay || 1000; // 1 second
    this.maxReconnectDelay = options.maxReconnectDelay || 30000; // 30 seconds
    this.reconnectMultiplier = options.reconnectMultiplier || 2;
    this.autoReconnect = options.autoReconnect !== false; // Enabled by default
    
    // Connection state
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectionTime = null;
    this.connectionId = this.generateConnectionId();
    
    // Reconnection context
    this.sessionId = null;
    this.userId = null;
    
    // Reconnection timer
    this.reconnectTimer = null;
    
    // Event callbacks
    this.eventCallbacks = new Map();
    
    // Connection metrics
    this.metrics = {
      totalConnections: 0,
      successfulReconnections: 0,
      failedReconnections: 0,
      averageReconnectTime: 0,
      lastError: null,
      uptime: 0,
      connectionHistory: []
    };
    
    // Start uptime tracking
    this.startTime = Date.now();
    this.uptimeInterval = setInterval(() => {
      this.updateUptime();
    }, 1000);
  }

  /**
   * Generate unique connection ID
   * @returns {string} Unique connection identifier
   */
  generateConnectionId() {
    return `client_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update connection state with session context
   * @param {boolean} connected - Connection status
   * @param {Object} context - Additional context information
   */
  updateConnectionState(connected, context = {}) {
    const wasConnected = this.isConnected;
    this.isConnected = connected;
    this.lastConnectionTime = Date.now();
    
    // Update session context
    if (context.sessionId) this.sessionId = context.sessionId;
    if (context.userId) this.userId = context.userId;
    
    // Add to connection history
    this.metrics.connectionHistory.push({
      timestamp: this.lastConnectionTime,
      connected,
      sessionId: this.sessionId,
      userId: this.userId,
      reason: context.reason || 'unknown'
    });
    
    // Keep only last 50 connection events
    if (this.metrics.connectionHistory.length > 50) {
      this.metrics.connectionHistory = this.metrics.connectionHistory.slice(-50);
    }
    
    if (connected && !wasConnected) {
      // Connection established
      this.metrics.totalConnections += 1;
      this.reconnectAttempts = 0;
      
      console.log(`✅ Client connection established`, {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        attempt: this.reconnectAttempts
      });
      
      this.emit('connected', {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        previousState: wasConnected ? 'connected' : 'disconnected',
        ...context
      });
    } else if (!connected && wasConnected) {
      // Connection lost
      console.log(`❌ Client connection lost`, {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        reason: context.reason || 'unknown',
        attempt: this.reconnectAttempts
      });
      
      this.emit('disconnected', {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        previousState: 'connected',
        reason: context.reason || 'unknown',
        ...context
      });
      
      // Auto-reconnect if enabled
      if (this.autoReconnect && !this.isReconnecting) {
        this.startAutoReconnection();
      }
    }
  }

  /**
   * Start automatic reconnection process
   */
  startAutoReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`⚠️ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('reconnection_exhausted', {
        totalAttempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        connectionId: this.connectionId
      });
      return;
    }

    this.attemptReconnection(() => {
      // This callback will be provided by the WebSocket service
      return this.reconnectCallback ? this.reconnectCallback() : Promise.resolve(false);
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @param {Function} reconnectCallback - Function to attempt reconnection
   * @returns {Promise<boolean>} Success status
   */
  async attemptReconnection(reconnectCallback) {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }

    this.isReconnecting = true;
    this.reconnectAttempts += 1;

    const delay = this.calculateReconnectDelay();
    const reconnectStartTime = Date.now();

    console.log(`🔄 Client attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    // Emit reconnection attempt event
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
      connectionId: this.connectionId,
      sessionId: this.sessionId,
      userId: this.userId
    });

    try {
      // Wait for delay
      await this.delay(delay);
      
      // Attempt reconnection
      const success = await reconnectCallback();
      
      const reconnectTime = Date.now() - reconnectStartTime;
      this.updateAverageReconnectTime(reconnectTime);

      if (success) {
        this.metrics.successfulReconnections += 1;
        this.isReconnecting = false;
        
        console.log(`✅ Client reconnection successful after ${this.reconnectAttempts} attempts`);
        
        this.emit('reconnected', {
          attempt: this.reconnectAttempts,
          reconnectTime,
          connectionId: this.connectionId,
          sessionId: this.sessionId,
          userId: this.userId
        });
        
        return true;
      } else {
        throw new Error('Reconnection callback returned false');
      }

    } catch (error) {
      const reconnectTime = Date.now() - reconnectStartTime;
      this.metrics.failedReconnections += 1;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now(),
        attempt: this.reconnectAttempts,
        sessionId: this.sessionId
      };

      console.error(`❌ Client reconnection attempt ${this.reconnectAttempts} failed:`, error.message);

      this.emit('reconnection_failed', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        error: error.message,
        reconnectTime,
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId
      });

      this.isReconnecting = false;

      // Schedule next attempt if we haven't reached max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.startAutoReconnection();
        }, this.calculateReconnectDelay());
      } else {
        // If we've reached max attempts, emit final failure
        this.emit('reconnection_exhausted', {
          totalAttempts: this.reconnectAttempts,
          lastError: this.metrics.lastError,
          connectionId: this.connectionId,
          sessionId: this.sessionId
        });
      }

      return false;
    }
  }

  /**
   * Calculate reconnect delay using exponential backoff
   * @returns {number} Delay in milliseconds
   */
  calculateReconnectDelay() {
    const delay = this.initialReconnectDelay * Math.pow(this.reconnectMultiplier, this.reconnectAttempts - 1);
    return Math.min(delay, this.maxReconnectDelay);
  }

  /**
   * Update average reconnection time metric
   * @param {number} reconnectTime - Time taken for reconnection
   */
  updateAverageReconnectTime(reconnectTime) {
    const totalSuccessful = this.metrics.successfulReconnections;
    const currentAverage = this.metrics.averageReconnectTime;
    
    // Calculate new average using incremental formula
    this.metrics.averageReconnectTime = totalSuccessful > 0 
      ? ((currentAverage * (totalSuccessful - 1)) + reconnectTime) / totalSuccessful
      : reconnectTime;
  }

  /**
   * Update uptime metric
   */
  updateUptime() {
    if (this.isConnected) {
      this.metrics.uptime = Date.now() - this.startTime;
    }
  }

  /**
   * Manually trigger reconnection
   * @param {Function} reconnectCallback - Function to attempt reconnection
   */
  async manualReconnect(reconnectCallback) {
    // Reset attempts for manual reconnection
    this.reconnectAttempts = 0;
    return this.attemptReconnection(reconnectCallback);
  }

  /**
   * Set the reconnection callback
   * @param {Function} callback - Reconnection callback function
   */
  setReconnectCallback(callback) {
    this.reconnectCallback = callback;
  }

  /**
   * Get current connection metrics
   * @returns {Object} Connection metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      connectionId: this.connectionId,
      sessionId: this.sessionId,
      userId: this.userId,
      lastConnectionTime: this.lastConnectionTime,
      currentReconnectDelay: this.calculateReconnectDelay(),
      uptime: this.metrics.uptime
    };
  }

  /**
   * Get connection health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const timeSinceLastConnection = this.lastConnectionTime ? Date.now() - this.lastConnectionTime : null;
    
    let status = 'healthy';
    let issues = [];
    let recommendations = [];

    if (!this.isConnected) {
      status = 'disconnected';
      issues.push('Connection is not established');
      recommendations.push('Check network connection');
    }

    if (this.isReconnecting) {
      status = 'reconnecting';
      issues.push('Currently attempting to reconnect');
      recommendations.push('Please wait for reconnection to complete');
    }

    if (this.reconnectAttempts > 0) {
      issues.push(`Reconnected ${this.reconnectAttempts} times`);
    }

    if (metrics.failedReconnections > metrics.successfulReconnections) {
      status = 'unhealthy';
      issues.push('More failed than successful reconnections');
      recommendations.push('Check network stability and server status');
    }

    if (timeSinceLastConnection && timeSinceLastConnection > 300000) { // 5 minutes
      issues.push('No recent connection activity');
      recommendations.push('Consider manually reconnecting');
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      status = 'failed';
      issues.push('Maximum reconnection attempts reached');
      recommendations.push('Manual reconnection required');
    }

    return {
      status,
      issues,
      recommendations,
      metrics,
      timestamp: Date.now()
    };
  }

  /**
   * Register event callback
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   */
  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }

  /**
   * Remove event callback
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   */
  off(event, callback) {
    if (this.eventCallbacks.has(event)) {
      const callbacks = this.eventCallbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to registered callbacks
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    if (this.eventCallbacks.has(event)) {
      this.eventCallbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * Utility method to delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset reconnection manager state
   */
  reset() {
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectionTime = null;
    this.connectionId = this.generateConnectionId();
    this.sessionId = null;
    this.userId = null;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.emit('reset', {
      connectionId: this.connectionId,
      timestamp: Date.now()
    });
  }

  /**
   * Shutdown reconnection manager and cleanup resources
   */
  shutdown() {
    console.log('🔄 Shutting down ReconnectionManager...');
    
    // Clear intervals
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear event callbacks
    this.eventCallbacks.clear();

    // Reset state
    this.reset();

    console.log('✅ ReconnectionManager shutdown complete');
  }

  /**
   * Enable or disable auto reconnection
   * @param {boolean} enabled - Whether auto reconnection should be enabled
   */
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    console.log(`Auto reconnection ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export default ReconnectionManager;
