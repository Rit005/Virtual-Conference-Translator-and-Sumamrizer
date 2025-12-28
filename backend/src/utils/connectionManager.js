/**
 * ConnectionManager - Production-grade connection management utility
 * Handles reconnection logic, connection state tracking, and error recovery
 */

class ConnectionManager {
  constructor(options = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.initialReconnectDelay = options.initialReconnectDelay || 1000; // 1 second
    this.maxReconnectDelay = options.maxReconnectDelay || 30000; // 30 seconds
    this.reconnectMultiplier = options.reconnectMultiplier || 2;
    
    // Connection state
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectionTime = null;
    this.connectionId = this.generateConnectionId();
    
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
      uptime: 0
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
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update connection state
   * @param {boolean} connected - Connection status
   * @param {Object} context - Additional context information
   */
  updateConnectionState(connected, context = {}) {
    const wasConnected = this.isConnected;
    this.isConnected = connected;
    this.lastConnectionTime = Date.now();
    
    if (connected && !wasConnected) {
      // Connection established
      this.metrics.totalConnections += 1;
      this.reconnectAttempts = 0;
      this.emit('connected', {
        connectionId: this.connectionId,
        previousState: wasConnected ? 'connected' : 'disconnected',
        ...context
      });
    } else if (!connected && wasConnected) {
      // Connection lost
      this.emit('disconnected', {
        connectionId: this.connectionId,
        previousState: 'connected',
        reason: context.reason || 'unknown',
        ...context
      });
    }
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

    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    // Emit reconnection attempt event
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
      connectionId: this.connectionId
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
        
        console.log(`✅ Reconnection successful after ${this.reconnectAttempts} attempts`);
        
        this.emit('reconnected', {
          attempt: this.reconnectAttempts,
          reconnectTime,
          connectionId: this.connectionId
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
        attempt: this.reconnectAttempts
      };

      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);

      this.emit('reconnection_failed', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        error: error.message,
        reconnectTime,
        connectionId: this.connectionId
      });

      this.isReconnecting = false;

      // If we've reached max attempts, emit final failure
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('reconnection_exhausted', {
          totalAttempts: this.reconnectAttempts,
          lastError: this.metrics.lastError,
          connectionId: this.connectionId
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
    this.metrics.averageReconnectTime = ((currentAverage * (totalSuccessful - 1)) + reconnectTime) / totalSuccessful;
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

    if (!this.isConnected) {
      status = 'disconnected';
      issues.push('Connection is not established');
    }

    if (this.isReconnecting) {
      status = 'reconnecting';
      issues.push('Currently attempting to reconnect');
    }

    if (this.reconnectAttempts > 0) {
      issues.push(`Reconnected ${this.reconnectAttempts} times`);
    }

    if (metrics.failedReconnections > metrics.successfulReconnections) {
      status = 'unhealthy';
      issues.push('More failed than successful reconnections');
    }

    if (timeSinceLastConnection && timeSinceLastConnection > 300000) { // 5 minutes
      issues.push('No recent connection activity');
    }

    return {
      status,
      issues,
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
   * Reset connection manager state
   */
  reset() {
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.lastConnectionTime = null;
    this.connectionId = this.generateConnectionId();
    
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
   * Shutdown connection manager and cleanup resources
   */
  shutdown() {
    console.log('🔄 Shutting down ConnectionManager...');
    
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

    console.log('✅ ConnectionManager shutdown complete');
  }

  /**
   * Create a ConnectionManager optimized for WebSocket connections
   * @param {Object} options - Configuration options
   * @returns {ConnectionManager} Configured connection manager
   */
  static createWebSocketManager(options = {}) {
    return new ConnectionManager({
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      initialReconnectDelay: options.initialReconnectDelay || 1000,
      maxReconnectDelay: options.maxReconnectDelay || 30000,
      reconnectMultiplier: options.reconnectMultiplier || 2,
      ...options
    });
  }
}

export default ConnectionManager;
