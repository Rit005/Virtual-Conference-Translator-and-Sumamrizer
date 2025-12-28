/**
 * EnhancedReconnectionManager - Production-grade reconnection with circuit breaker
 * Features: Circuit breaker patterns, health monitoring, jitter, advanced strategies
 */

class EnhancedReconnectionManager {
  constructor(options = {}) {
    // Basic reconnection settings
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.initialReconnectDelay = options.initialReconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.reconnectMultiplier = options.reconnectMultiplier || 2;
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      successThreshold: options.successThreshold || 3 // For HALF_OPEN state
    };
    
    // Connection health monitoring
    this.healthChecks = {
      lastHeartbeat: null,
      heartbeatInterval: options.heartbeatInterval || 30000,
      missedHeartbeats: 0,
      maxMissedHeartbeats: options.maxMissedHeartbeats || 3,
      responseTimeThreshold: options.responseTimeThreshold || 5000 // 5 seconds
    };
    
    // Reconnection strategies
    this.strategies = {
      immediate: () => 0,
      exponential: (attempt) => Math.min(this.initialReconnectDelay * Math.pow(this.reconnectMultiplier, attempt - 1), this.maxReconnectDelay),
      linear: (attempt) => Math.min(this.initialReconnectDelay * attempt, this.maxReconnectDelay),
      fibonacci: (attempt) => {
        const fib = [1, 1, 2, 3, 5, 8, 13, 21];
        const delay = fib[Math.min(attempt - 1, fib.length - 1)] * this.initialReconnectDelay;
        return Math.min(delay, this.maxReconnectDelay);
      }
    };
    
    this.currentStrategy = options.strategy || 'exponential';
    this.applyJitter = options.applyJitter !== false;
    this.jitterRange = options.jitterRange || 1000; // ±1 second
    
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
    this.healthCheckTimer = null;
    
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
      connectionHistory: [],
      circuitBreakerTransitions: [],
      healthCheckResults: [],
      strategyChanges: []
    };
    
    // Start uptime tracking
    this.startTime = Date.now();
    this.uptimeInterval = setInterval(() => {
      this.updateUptime();
    }, 1000);
    
    // Start health monitoring if enabled
    if (options.enableHealthMonitoring !== false) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Generate unique connection ID
   * @returns {string} Unique connection identifier
   */
  generateConnectionId() {
    return `client_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update connection state with enhanced context
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
      reason: context.reason || 'unknown',
      connectionId: this.connectionId
    });
    
    // Keep only last 50 connection events
    if (this.metrics.connectionHistory.length > 50) {
      this.metrics.connectionHistory = this.metrics.connectionHistory.slice(-50);
    }
    
    if (connected && !wasConnected) {
      // Connection established
      this.metrics.totalConnections += 1;
      this.reconnectAttempts = 0;
      
      // Record success for circuit breaker
      this.recordConnectionSuccess();
      
      console.log(`✅ Client connection established`, {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        attempt: this.reconnectAttempts,
        circuitBreakerState: this.circuitBreaker.state
      });
      
      this.emit('connected', {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        previousState: wasConnected ? 'connected' : 'disconnected',
        circuitBreakerState: this.circuitBreaker.state,
        ...context
      });
      
      // Reset health check counters
      this.healthChecks.missedHeartbeats = 0;
      
    } else if (!connected && wasConnected) {
      // Connection lost
      console.log(`❌ Client connection lost`, {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        reason: context.reason || 'unknown',
        attempt: this.reconnectAttempts,
        circuitBreakerState: this.circuitBreaker.state
      });
      
      this.emit('disconnected', {
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        previousState: 'connected',
        reason: context.reason || 'unknown',
        circuitBreakerState: this.circuitBreaker.state,
        ...context
      });
      
      // Record failure for circuit breaker
      this.recordConnectionFailure(context.reason || 'unknown');
      
      // Auto-reconnect if enabled and circuit breaker allows
      if (context.autoReconnect !== false && !this.isReconnecting) {
        this.startAutoReconnection();
      }
    }
  }

  /**
   * Enhanced reconnection with circuit breaker and strategies
   * @param {Function} reconnectCallback - Function to attempt reconnection
   * @returns {Promise<boolean>} Success status
   */
  async attemptReconnection(reconnectCallback) {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      console.warn(`⚠️ Circuit breaker is ${this.circuitBreaker.state}, skipping reconnection attempt`);
      this.emit('circuit_breaker_blocked', {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        timeUntilNextAttempt: this.getTimeUntilNextAttempt()
      });
      return false;
    }

    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }

    this.isReconnecting = true;
    this.reconnectAttempts += 1;

    // Calculate delay using current strategy
    const baseDelay = this.calculateReconnectDelay();
    const delay = this.applyJitter ? this.applyJitterToDelay(baseDelay) : baseDelay;
    const reconnectStartTime = Date.now();

    console.log(`🔄 Client attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`, {
      strategy: this.currentStrategy,
      baseDelay,
      finalDelay: delay,
      circuitBreakerState: this.circuitBreaker.state
    });

    // Emit reconnection attempt event
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
      connectionId: this.connectionId,
      sessionId: this.sessionId,
      userId: this.userId,
      strategy: this.currentStrategy,
      baseDelay,
      circuitBreakerState: this.circuitBreaker.state
    });

    try {
      // Wait for delay
      await this.delay(delay);
      
      // Attempt reconnection with timeout
      const reconnectionPromise = reconnectCallback();
      const timeoutPromise = this.delay(30000); // 30 second timeout
      
      const success = await Promise.race([reconnectionPromise, timeoutPromise]);
      
      const reconnectTime = Date.now() - reconnectStartTime;
      this.updateAverageReconnectTime(reconnectTime);

      if (success) {
        this.metrics.successfulReconnections += 1;
        this.isReconnecting = false;
        
        // Record success for circuit breaker
        this.recordConnectionSuccess();
        
        console.log(`✅ Client reconnection successful after ${this.reconnectAttempts} attempts`, {
          reconnectTime,
          strategy: this.currentStrategy,
          circuitBreakerState: this.circuitBreaker.state
        });
        
        this.emit('reconnected', {
          attempt: this.reconnectAttempts,
          reconnectTime,
          connectionId: this.connectionId,
          sessionId: this.sessionId,
          userId: this.userId,
          strategy: this.currentStrategy,
          circuitBreakerState: this.circuitBreaker.state
        });
        
        return true;
      } else {
        throw new Error('Reconnection callback returned false or timed out');
      }

    } catch (error) {
      const reconnectTime = Date.now() - reconnectStartTime;
      this.metrics.failedReconnections += 1;
      this.metrics.lastError = {
        message: error.message,
        timestamp: Date.now(),
        attempt: this.reconnectAttempts,
        sessionId: this.sessionId,
        circuitBreakerState: this.circuitBreaker.state
      };

      console.error(`❌ Client reconnection attempt ${this.reconnectAttempts} failed:`, error.message);

      // Record failure for circuit breaker
      this.recordConnectionFailure(error.message);

      this.emit('reconnection_failed', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        error: error.message,
        reconnectTime,
        connectionId: this.connectionId,
        sessionId: this.sessionId,
        userId: this.userId,
        strategy: this.currentStrategy,
        circuitBreakerState: this.circuitBreaker.state
      });

      this.isReconnecting = false;

      // Schedule next attempt if we haven't reached max attempts and circuit breaker allows
      if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isCircuitBreakerOpen()) {
        setTimeout(() => {
          this.startAutoReconnection();
        }, this.calculateReconnectDelay());
      } else {
        // If we've reached max attempts or circuit breaker is open, emit final failure
        this.emit('reconnection_exhausted', {
          totalAttempts: this.reconnectAttempts,
          lastError: this.metrics.lastError,
          connectionId: this.connectionId,
          sessionId: this.sessionId,
          circuitBreakerState: this.circuitBreaker.state
        });
      }

      return false;
    }
  }

  /**
   * Check if circuit breaker allows connection attempts
   * @returns {boolean} Whether circuit breaker allows attempts
   */
  isCircuitBreakerOpen() {
    if (this.circuitBreaker.state === 'CLOSED') return false;
    
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure >= this.circuitBreaker.recoveryTimeout) {
        // Transition to HALF_OPEN state
        this.circuitBreaker.state = 'HALF_OPEN';
        this.recordCircuitBreakerTransition('OPEN', 'HALF_OPEN');
        console.log('🔄 Circuit breaker transitioned from OPEN to HALF_OPEN');
        return false;
      }
      return true;
    }
    
    return false; // HALF_OPEN state allows attempts
  }

  /**
   * Record connection failure for circuit breaker
   * @param {string} reason - Failure reason
   */
  recordConnectionFailure(reason) {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      // In HALF_OPEN state, any failure should open the circuit
      this.circuitBreaker.state = 'OPEN';
      this.recordCircuitBreakerTransition('HALF_OPEN', 'OPEN', reason);
      console.error('❌ Circuit breaker OPENED due to failure in HALF_OPEN state');
    } else if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold && this.circuitBreaker.state === 'CLOSED') {
      // In CLOSED state, open after reaching threshold
      this.circuitBreaker.state = 'OPEN';
      this.recordCircuitBreakerTransition('CLOSED', 'OPEN', reason);
      console.error('❌ Circuit breaker OPENED due to repeated failures');
    }
  }

  /**
   * Record successful connection for circuit breaker
   */
  recordConnectionSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      // In HALF_OPEN state, record successful connection
      if (!this.halfOpenSuccessCount) {
        this.halfOpenSuccessCount = 0;
      }
      this.halfOpenSuccessCount++;
      
      if (this.halfOpenSuccessCount >= this.circuitBreaker.successThreshold) {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failureCount = 0;
        this.halfOpenSuccessCount = 0;
        this.recordCircuitBreakerTransition('HALF_OPEN', 'CLOSED', 'success_threshold_reached');
        console.log('✅ Circuit breaker reset to CLOSED state after successful connections');
      }
    } else if (this.circuitBreaker.state === 'CLOSED') {
      // In CLOSED state, reset failure count on success
      this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1);
    }
  }

  /**
   * Record circuit breaker state transition
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @param {string} reason - Transition reason
   */
  recordCircuitBreakerTransition(from, to, reason) {
    this.metrics.circuitBreakerTransitions.push({
      from,
      to,
      reason,
      timestamp: Date.now(),
      failureCount: this.circuitBreaker.failureCount
    });
    
    // Keep only last 20 transitions
    if (this.metrics.circuitBreakerTransitions.length > 20) {
      this.metrics.circuitBreakerTransitions = this.metrics.circuitBreakerTransitions.slice(-20);
    }
  }

  /**
   * Calculate time until next circuit breaker attempt
   * @returns {number} Time in milliseconds
   */
  getTimeUntilNextAttempt() {
    if (this.circuitBreaker.state !== 'OPEN') return 0;
    
    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
    const timeRemaining = this.circuitBreaker.recoveryTimeout - timeSinceLastFailure;
    
    return Math.max(0, timeRemaining);
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
   * Calculate reconnect delay using current strategy
   * @returns {number} Delay in milliseconds
   */
  calculateReconnectDelay() {
    const strategy = this.strategies[this.currentStrategy] || this.strategies.exponential;
    return strategy(this.reconnectAttempts);
  }

  /**
   * Apply jitter to delay to prevent thundering herd
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {number} Delayed time with jitter
   */
  applyJitterToDelay(baseDelay) {
    const jitter = (Math.random() - 0.5) * 2 * this.jitterRange;
    return Math.max(0, baseDelay + jitter);
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
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) return;
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthChecks.heartbeatInterval);
    
    console.log('🏥 Health monitoring started');
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.healthChecks.lastHeartbeat;
    
    if (this.isConnected) {
      this.healthChecks.lastHeartbeat = now;
      this.healthChecks.missedHeartbeats = 0;
      
      this.metrics.healthCheckResults.push({
        timestamp: now,
        status: 'healthy',
        responseTime: 0,
        missedHeartbeats: 0
      });
      
    } else {
      this.healthChecks.missedHeartbeats++;
      
      const healthResult = {
        timestamp: now,
        status: this.healthChecks.missedHeartbeats >= this.healthChecks.maxMissedHeartbeats ? 'unhealthy' : 'degraded',
        responseTime: timeSinceLastHeartbeat,
        missedHeartbeats: this.healthChecks.missedHeartbeats
      };
      
      this.metrics.healthCheckResults.push(healthResult);
      
      if (this.healthChecks.missedHeartbeats >= this.healthChecks.maxMissedHeartbeats) {
        console.warn(`⚠️ Health check failed: ${this.healthChecks.missedHeartbeats} missed heartbeats`);
        
        this.emit('health_check_failed', {
          missedHeartbeats: this.healthChecks.missedHeartbeats,
          timeSinceLastHeartbeat,
          maxMissed: this.healthChecks.maxMissedHeartbeats
        });
      }
    }
    
    // Keep only last 100 health check results
    if (this.metrics.healthCheckResults.length > 100) {
      this.metrics.healthCheckResults = this.metrics.healthCheckResults.slice(-100);
    }
  }

  /**
   * Change reconnection strategy
   * @param {string} newStrategy - New strategy name
   */
  changeStrategy(newStrategy) {
    if (this.strategies[newStrategy]) {
      const oldStrategy = this.currentStrategy;
      this.currentStrategy = newStrategy;
      
      this.metrics.strategyChanges.push({
        from: oldStrategy,
        to: newStrategy,
        timestamp: Date.now(),
        reconnectAttempts: this.reconnectAttempts
      });
      
      console.log(`🔄 Reconnection strategy changed: ${oldStrategy} → ${newStrategy}`);
      
      this.emit('strategy_changed', {
        from: oldStrategy,
        to: newStrategy,
        reconnectAttempts: this.reconnectAttempts
      });
    } else {
      console.warn(`Unknown reconnection strategy: ${newStrategy}`);
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
   * Get enhanced connection metrics
   * @returns {Object} Enhanced connection metrics
   */
  getMetrics() {
    const healthStatus = this.getHealthStatus();
    
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
      uptime: this.metrics.uptime,
      circuitBreaker: {
        ...this.circuitBreaker,
        timeUntilNextAttempt: this.getTimeUntilNextAttempt()
      },
      health: healthStatus,
      strategy: this.currentStrategy
    };
  }

  /**
   * Get enhanced connection health status
   * @returns {Object} Enhanced health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const timeSinceLastConnection = this.lastConnectionTime ? Date.now() - this.lastConnectionTime : null;
    const recentHealthChecks = this.metrics.healthCheckResults.slice(-10);
    const unhealthyChecks = recentHealthChecks.filter(check => check.status === 'unhealthy').length;
    
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

    if (this.circuitBreaker.state === 'OPEN') {
      status = 'circuit_breaker_open';
      issues.push('Circuit breaker is OPEN - repeated failures detected');
      recommendations.push(`Wait ${Math.ceil(this.getTimeUntilNextAttempt() / 1000)} seconds before retrying`);
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      status = 'circuit_breaker_half_open';
      issues.push('Circuit breaker is HALF_OPEN - testing recovery');
      recommendations.push('Connection attempts are being tested');
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

    if (unhealthyChecks >= 3) {
      status = 'unhealthy';
      issues.push('Multiple consecutive health check failures');
      recommendations.push('Check system resources and network connectivity');
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
      circuitBreakerState: this.circuitBreaker.state,
      healthChecks: {
        recent: recentHealthChecks,
        missedHeartbeats: this.healthChecks.missedHeartbeats,
        maxMissed: this.healthChecks.maxMissedHeartbeats
      },
      timestamp: Date.now()
    };
  }

  // Event system methods

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
    
    // Reset circuit breaker
    this.circuitBreaker = {
      ...this.circuitBreaker,
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED'
    };
    this.halfOpenSuccessCount = 0;
    
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
    console.log('🔄 Shutting down EnhancedReconnectionManager...');
    
    // Clear intervals
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear event callbacks
    this.eventCallbacks.clear();

    // Log final metrics
    const finalMetrics = this.getMetrics();
    console.log('EnhancedReconnectionManager shutdown metrics:', finalMetrics);

    // Reset state
    this.reset();

    console.log('✅ EnhancedReconnectionManager shutdown complete');
  }

  /**
   * Enable or disable auto reconnection
   * @param {boolean} enabled - Whether auto reconnection should be enabled
   */
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    console.log(`Auto reconnection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force circuit breaker state (for testing)
   * @param {string} state - Circuit breaker state
   */
  forceCircuitBreakerState(state) {
    if (['CLOSED', 'OPEN', 'HALF_OPEN'].includes(state)) {
      this.circuitBreaker.state = state;
      this.recordCircuitBreakerTransition('FORCED', state, 'manual_override');
      console.log(`🔧 Circuit breaker state forced to: ${state}`);
    }
  }
}

export default EnhancedReconnectionManager;
