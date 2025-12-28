/**
 * ErrorLogger - Production-grade structured error logging with sessionId context
 * Provides centralized logging with comprehensive context tracking
 */

class ErrorLogger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'INFO';
    this.sessionContext = new Map(); // sessionId -> context data
    this.errorCounts = new Map(); // errorType -> count
    this.maxErrorHistory = options.maxErrorHistory || 1000;
    this.errorHistory = [];
    this.requestContexts = new Map(); // requestId -> context
    
    // Log levels
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    
    // Session tracking
    this.activeSessions = new Set();
    this.sessionMetrics = new Map();
    
    // Error aggregation
    this.errorPatterns = new Map(); // pattern -> count
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // Clean up every 5 minutes
  }

  /**
   * Log error with comprehensive session context
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
   * @param {string} errorType - Type/category of error
   * @param {string} message - Log message
   * @param {Object} context - Additional context information
   * @param {Error} error - Optional error object
   */
  log(level, errorType, message, context = {}, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: this.levels[level] || this.levels.INFO,
      levelName: level,
      errorType,
      message,
      context: {
        ...this.getGlobalContext(),
        ...context,
        sessionId: context.sessionId || this.getCurrentSessionId(),
        userId: context.userId || this.getCurrentUserId(),
        requestId: context.requestId || this.generateRequestId(),
        socketId: context.socketId,
        component: context.component || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        stackTrace: error ? this.formatStackTrace(error.stack) : null,
        memoryUsage: this.getMemoryUsage(),
        uptime: process.uptime()
      }
    };

    // Add to history
    this.errorHistory.push(logEntry);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // Update error counts and patterns
    this.updateErrorCounts(errorType);
    this.updateErrorPatterns(errorType, message, context);

    // Update session context
    if (context.sessionId) {
      this.updateSessionContext(context.sessionId, context);
    }

    // Update request context
    if (context.requestId) {
      this.updateRequestContext(context.requestId, logEntry);
    }

    // Output to console with enhanced formatting
    this.outputLog(logEntry);

    // Emit events for monitoring systems
    this.emitLogEvents(logEntry);
  }

  /**
   * Debug level logging
   */
  debug(errorType, message, context = {}) {
    if (this.shouldLog('DEBUG')) {
      this.log('DEBUG', errorType, message, context);
    }
  }

  /**
   * Info level logging
   */
  info(errorType, message, context = {}) {
    if (this.shouldLog('INFO')) {
      this.log('INFO', errorType, message, context);
    }
  }

  /**
   * Warning level logging
   */
  warn(errorType, message, context = {}) {
    if (this.shouldLog('WARN')) {
      this.log('WARN', errorType, message, context);
    }
  }

  /**
   * Error level logging
   */
  error(errorType, message, context = {}, error = null) {
    this.log('ERROR', errorType, message, context, error);
  }

  /**
   * Critical level logging
   */
  critical(errorType, message, context = {}, error = null) {
    this.log('CRITICAL', errorType, message, context, error);
  }

  /**
   * Enhanced error logging for WebSocket events
   */
  logWebSocketEvent(event, data, context = {}) {
    const enhancedContext = {
      ...context,
      event,
      eventSize: JSON.stringify(data).length,
      component: 'websocket'
    };

    this.debug('websocket_event', `WebSocket event: ${event}`, enhancedContext);
  }

  /**
   * Enhanced error logging for audio chunk processing
   */
  logAudioChunk(sessionId, userId, chunkId, action, context = {}) {
    const enhancedContext = {
      ...context,
      sessionId,
      userId,
      chunkId,
      component: 'audio_chunk_handler',
      action
    };

    this.debug('audio_chunk_operation', `Audio chunk ${action}`, enhancedContext);
  }

  /**
   * Enhanced error logging for transcription events
   */
  logTranscription(sessionId, userId, text, confidence, context = {}) {
    const enhancedContext = {
      ...context,
      sessionId,
      userId,
      textLength: text?.length || 0,
      confidence,
      component: 'transcription_agent'
    };

    this.info('transcription_event', `Transcription completed`, enhancedContext);
  }

  /**
   * Get comprehensive error statistics
   */
  getErrorStats() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const recentErrors = this.errorHistory.filter(
      entry => new Date(entry.timestamp).getTime() > oneHourAgo
    );

    const errorTypes = {};
    const sessionErrors = {};
    const userErrors = {};

    recentErrors.forEach(entry => {
      // Count by error type
      errorTypes[entry.errorType] = (errorTypes[entry.errorType] || 0) + 1;

      // Count by session
      if (entry.context.sessionId) {
        sessionErrors[entry.context.sessionId] = (sessionErrors[entry.context.sessionId] || 0) + 1;
      }

      // Count by user
      if (entry.context.userId) {
        userErrors[entry.context.userId] = (userErrors[entry.context.userId] || 0) + 1;
      }
    });

    return {
      totalErrors: recentErrors.length,
      errorTypes,
      sessionErrors,
      userErrors,
      recentErrors: recentErrors.slice(-10),
      sessionContexts: Array.from(this.sessionContext.entries()),
      errorPatterns: Array.from(this.errorPatterns.entries()),
      activeSessions: this.activeSessions.size,
      timestamp: now
    };
  }

  /**
   * Get session-specific error context
   */
  getSessionContext(sessionId) {
    return this.sessionContext.get(sessionId) || {};
  }

  /**
   * Get request-specific context
   */
  getRequestContext(requestId) {
    return this.requestContexts.get(requestId) || {};
  }

  /**
   * Track session start
   */
  trackSessionStart(sessionId, context = {}) {
    this.activeSessions.add(sessionId);
    this.updateSessionContext(sessionId, {
      ...context,
      status: 'active',
      startTime: Date.now()
    });
  }

  /**
   * Track session end
   */
  trackSessionEnd(sessionId, context = {}) {
    this.activeSessions.delete(sessionId);
    this.updateSessionContext(sessionId, {
      ...context,
      status: 'ended',
      endTime: Date.now()
    });
  }

  /**
   * Set global context for all logs
   */
  setGlobalContext(context) {
    this.globalContext = { ...this.globalContext, ...context };
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.errorPatterns.clear();
  }

  /**
   * Export error logs for analysis
   */
  exportLogs(options = {}) {
    const {
      startTime,
      endTime,
      errorTypes,
      sessionIds,
      format = 'json'
    } = options;

    let filteredLogs = [...this.errorHistory];

    // Apply filters
    if (startTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() >= startTime
      );
    }

    if (endTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() <= endTime
      );
    }

    if (errorTypes && errorTypes.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        errorTypes.includes(log.errorType)
      );
    }

    if (sessionIds && sessionIds.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        sessionIds.includes(log.context.sessionId)
      );
    }

    return format === 'csv' ? this.convertToCSV(filteredLogs) : filteredLogs;
  }

  // Private methods

  /**
   * Check if message should be logged based on level
   */
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  /**
   * Get global context information
   */
  getGlobalContext() {
    return {
      ...this.globalContext,
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Update session context
   */
  updateSessionContext(sessionId, context) {
    const existing = this.sessionContext.get(sessionId) || {};
    this.sessionContext.set(sessionId, {
      ...existing,
      ...context,
      lastUpdated: Date.now()
    });
  }

  /**
   * Update request context
   */
  updateRequestContext(requestId, logEntry) {
    const existing = this.requestContexts.get(requestId) || {};
    this.requestContexts.set(requestId, {
      ...existing,
      ...logEntry.context,
      lastLog: logEntry.timestamp,
      logCount: (existing.logCount || 0) + 1
    });
  }

  /**
   * Update error counts
   */
  updateErrorCounts(errorType) {
    this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
  }

  /**
   * Update error patterns for analysis
   */
  updateErrorPatterns(errorType, message, context) {
    const pattern = `${errorType}:${message.substring(0, 50)}`;
    this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
  }

  /**
   * Format stack trace for logging
   */
  formatStackTrace(stackTrace) {
    if (!stackTrace) return null;
    
    return stackTrace
      .split('\n')
      .slice(0, 10) // Limit to first 10 lines
      .map(line => line.trim())
      .join(' -> ');
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * Output log entry with enhanced formatting
   */
  outputLog(logEntry) {
    const color = this.getLogColor(logEntry.levelName);
    const timestamp = logEntry.timestamp;
    const level = logEntry.levelName.padEnd(7);
    const errorType = logEntry.errorType.padEnd(20);
    const sessionId = logEntry.context.sessionId || 'N/A';
    const userId = logEntry.context.userId || 'N/A';

    console.log(
      `${color}[${timestamp}] ${level} ${errorType} | Session: ${sessionId} | User: ${userId} | ${logEntry.message}`,
      logEntry.context.component ? `{${logEntry.context.component}}` : ''
    );

    // Log stack trace for errors
    if (logEntry.levelName === 'ERROR' || logEntry.levelName === 'CRITICAL') {
      if (logEntry.context.stackTrace) {
        console.log(color + logEntry.context.stackTrace);
      }
    }
  }

  /**
   * Get color for log level
   */
  getLogColor(level) {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      CRITICAL: '\x1b[35m' // Magenta
    };
    return colors[level] || '\x1b[0m'; // Reset
  }

  /**
   * Emit log events for monitoring
   */
  emitLogEvents(logEntry) {
    // This could integrate with external monitoring systems
    if (logEntry.levelName === 'ERROR' || logEntry.levelName === 'CRITICAL') {
      // Emit critical error event
      process.emit('error_logged', logEntry);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID from context
   */
  getCurrentSessionId() {
    // This would be set by the active session context
    return this.currentSessionId || null;
  }

  /**
   * Get current user ID from context
   */
  getCurrentUserId() {
    // This would be set by the active user context
    return this.currentUserId || null;
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    const headers = ['timestamp', 'level', 'errorType', 'message', 'sessionId', 'userId', 'component'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.levelName,
        log.errorType,
        `"${log.message.replace(/"/g, '""')}"`,
        log.context.sessionId || '',
        log.context.userId || '',
        log.context.component || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Perform cleanup of old data
   */
  performCleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old error history
    this.errorHistory = this.errorHistory.filter(
      log => now - new Date(log.timestamp).getTime() < maxAge
    );

    // Clean up old request contexts
    for (const [requestId, context] of this.requestContexts.entries()) {
      if (now - context.lastLog > maxAge) {
        this.requestContexts.delete(requestId);
      }
    }

    // Clean up inactive session contexts (older than 1 hour)
    for (const [sessionId, context] of this.sessionContext.entries()) {
      if (!this.activeSessions.has(sessionId) && 
          now - (context.lastUpdated || 0) > 60 * 60 * 1000) {
        this.sessionContext.delete(sessionId);
      }
    }
  }

  /**
   * Shutdown error logger and cleanup resources
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.info('error_logger_shutdown', 'Error logger shutting down', {
      totalLogsProcessed: this.errorHistory.length,
      activeSessions: this.activeSessions.size
    });

    // Clear all data
    this.errorHistory = [];
    this.sessionContext.clear();
    this.requestContexts.clear();
    this.errorCounts.clear();
    this.errorPatterns.clear();
    this.activeSessions.clear();
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

export default errorLogger;
