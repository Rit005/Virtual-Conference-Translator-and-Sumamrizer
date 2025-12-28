/**
 * AdvancedRateLimiter - Production-grade rate limiting with burst protection
 * Features: Sliding windows, burst protection, priority-based limiting, detailed metrics
 */

import errorLogger from './errorLogger.js';

class AdvancedRateLimiter {
  constructor(options = {}) {
    // Core rate limiting configuration
    this.maxRequests = options.maxRequests || 10; // Max requests per window
    this.windowMs = options.windowMs || 1000; // Time window in ms
    this.keyGenerator = options.keyGenerator || ((...args) => args.join(':'));
    this.message = options.message || 'Rate limit exceeded';
    
    // Burst protection configuration
    this.burstLimit = options.burstLimit || 20; // Max burst size
    this.burstWindow = options.burstWindow || 100; // Burst window in ms
    
    // Priority-based limiting
    this.priorities = {
      CRITICAL: 1,
      HIGH: 2,
      NORMAL: 3,
      LOW: 4
    };
    
    // Sliding window tracking
    this.slidingWindows = new Map(); // key -> window data
    this.requestHistory = new Map(); // key -> array of request timestamps
    
    // Rate limiting data: key -> { count, resetTime, burstCount }
    this.requests = new Map();
    
    // Metrics and monitoring
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      burstRequests: 0,
      averageWaitTime: 0,
      startTime: Date.now()
    };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
    
    // Priority configurations
    this.priorityConfigs = {
      CRITICAL: { multiplier: 2, maxRequests: this.maxRequests * 2 },
      HIGH: { multiplier: 1.5, maxRequests: Math.ceil(this.maxRequests * 1.5) },
      NORMAL: { multiplier: 1, maxRequests: this.maxRequests },
      LOW: { multiplier: 0.5, maxRequests: Math.floor(this.maxRequests * 0.5) }
    };
  }

  /**
   * Check rate limit with advanced features
   * @param {string} key - Unique identifier for rate limit
   * @param {string} priority - Request priority (CRITICAL, HIGH, NORMAL, LOW)
   * @param {Object} context - Additional context for logging
   * @returns {Object} Rate limit result
   */
  checkLimit(key, priority = 'NORMAL', context = {}) {
    const identifier = this.keyGenerator(key, context);
    const now = Date.now();
    
    // Update metrics
    this.metrics.totalRequests++;
    
    // Clean up expired entries
    this.cleanup();
    this.cleanupSlidingWindow(identifier, now);
    
    // Get or create window data
    let windowData = this.slidingWindows.get(identifier);
    if (!windowData) {
      windowData = {
        requests: [],
        burstRequests: [],
        lastReset: now,
        priority: priority,
        stats: {
          totalRequests: 0,
          allowedRequests: 0,
          blockedRequests: 0
        }
      };
      this.slidingWindows.set(identifier, windowData);
    }
    
    // Get priority configuration
    const priorityConfig = this.priorityConfigs[priority] || this.priorityConfigs.NORMAL;
    const effectiveMaxRequests = priorityConfig.maxRequests;
    
    // Clean burst requests
    windowData.burstRequests = windowData.burstRequests.filter(
      time => now - time < this.burstWindow
    );
    
    // Check burst limit
    if (windowData.burstRequests.length >= this.burstLimit) {
      this.metrics.blockedRequests++;
      windowData.stats.blockedRequests++;
      
      // Log rate limit violation
      errorLogger.warn('rate_limit_burst_exceeded', `Burst limit exceeded for ${identifier}`, {
        ...context,
        priority,
        burstCount: windowData.burstRequests.length,
        burstLimit: this.burstLimit,
        windowData: {
          totalRequests: windowData.stats.totalRequests,
          allowedRequests: windowData.stats.allowedRequests,
          blockedRequests: windowData.stats.blockedRequests
        }
      });
      
      return {
        allowed: false,
        reason: 'burst_limit_exceeded',
        remaining: 0,
        resetTime: windowData.lastReset + this.windowMs,
        priority,
        effectiveLimit: effectiveMaxRequests
      };
    }
    
    // Get or create regular rate limit data
    let rateData = this.requests.get(identifier);
    if (!rateData) {
      rateData = {
        count: 0,
        resetTime: now + this.windowMs,
        priority: priority
      };
      this.requests.set(identifier, rateData);
    }
    
    // Reset if window has passed
    if (now >= rateData.resetTime) {
      rateData.count = 0;
      rateData.resetTime = now + this.windowMs;
      rateData.priority = priority;
    }
    
    // Check if request is allowed based on priority
    const allowed = rateData.count < effectiveMaxRequests;
    
    // Calculate remaining requests
    const remaining = Math.max(0, effectiveMaxRequests - rateData.count - (allowed ? 0 : 1));
    
    // Update statistics
    if (allowed) {
      rateData.count++;
      windowData.requests.push(now);
      windowData.burstRequests.push(now);
      this.metrics.allowedRequests++;
      windowData.stats.allowedRequests++;
      
      // Clean up old requests from sliding window
      windowData.requests = windowData.requests.filter(
        time => now - time < this.windowMs
      );
    } else {
      this.metrics.blockedRequests++;
      windowData.stats.blockedRequests++;
    }
    
    windowData.stats.totalRequests++;
    
    // Log rate limiting decision for monitoring
    if (!allowed) {
      errorLogger.debug('rate_limit_blocked', `Request blocked for ${identifier}`, {
        ...context,
        priority,
        currentCount: rateData.count,
        effectiveLimit: effectiveMaxRequests,
        remaining
      });
    }
    
    return {
      allowed,
      remaining,
      resetTime: rateData.resetTime,
      windowMs: this.windowMs,
      identifier,
      priority,
      effectiveLimit: effectiveMaxRequests,
      burstCount: windowData.burstRequests.length,
      burstLimit: this.burstLimit,
      waitTime: allowed ? 0 : (rateData.resetTime - now)
    };
  }

  /**
   * Consume one request from the limit
   * @param {string} key - Unique identifier for rate limit
   * @param {string} priority - Request priority
   * @param {Object} context - Additional context
   * @returns {Object} Rate limit result
   */
  consume(key, priority = 'NORMAL', context = {}) {
    return this.checkLimit(key, priority, context);
  }

  /**
   * Get detailed statistics for a specific key
   * @param {string} key - Unique identifier
   * @param {Object} context - Additional context
   * @returns {Object} Detailed statistics
   */
  getDetailedStats(key, context = {}) {
    const identifier = this.keyGenerator(key, context);
    const now = Date.now();
    const windowData = this.slidingWindows.get(identifier);
    
    if (!windowData) {
      return {
        allowed: true,
        remaining: this.maxRequests,
        windowMs: this.windowMs,
        burstCount: 0,
        burstLimit: this.burstLimit,
        priority: 'NORMAL',
        effectiveLimit: this.maxRequests,
        requestHistory: [],
        stats: {
          totalRequests: 0,
          allowedRequests: 0,
          blockedRequests: 0
        }
      };
    }
    
    const activeRequests = windowData.requests.filter(
      time => now - time < this.windowMs
    ).length;
    
    const burstCount = windowData.burstRequests.filter(
      time => now - time < this.burstWindow
    ).length;
    
    const priorityConfig = this.priorityConfigs[windowData.priority] || this.priorityConfigs.NORMAL;
    const effectiveLimit = priorityConfig.maxRequests;
    
    return {
      allowed: activeRequests < effectiveLimit,
      count: activeRequests,
      remaining: Math.max(0, effectiveLimit - activeRequests),
      windowMs: this.windowMs,
      burstCount,
      burstLimit: this.burstLimit,
      priority: windowData.priority,
      effectiveLimit,
      resetTime: windowData.lastReset + this.windowMs,
      requestHistory: windowData.requests.slice(-10), // Last 10 requests
      stats: { ...windowData.stats },
      lastRequest: windowData.requests.length > 0 ? windowData.requests[windowData.requests.length - 1] : null,
      nextAvailableTime: windowData.requests.length > 0 ? 
        windowData.requests[windowData.requests.length - 1] + this.windowMs : now
    };
  }

  /**
   * Get overall rate limiter metrics
   * @returns {Object} Overall metrics
   */
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      ...this.metrics,
      uptime,
      activeWindows: this.slidingWindows.size,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.allowedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      blockRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.blockedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      averageRequestsPerSecond: (this.metrics.totalRequests / (uptime / 1000)).toFixed(2),
      burstRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.burstRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Reset rate limit for a specific key
   * @param {string} key - Unique identifier
   * @param {Object} context - Additional context
   */
  reset(key, context = {}) {
    const identifier = this.keyGenerator(key, context);
    this.requests.delete(identifier);
    this.slidingWindows.delete(identifier);
    this.requestHistory.delete(identifier);
    
    errorLogger.debug('rate_limit_reset', `Rate limit reset for ${identifier}`, {
      ...context,
      identifier
    });
  }

  /**
   * Update priority for an existing key
   * @param {string} key - Unique identifier
   * @param {string} newPriority - New priority level
   * @param {Object} context - Additional context
   */
  updatePriority(key, newPriority, context = {}) {
    const identifier = this.keyGenerator(key, context);
    const windowData = this.slidingWindows.get(identifier);
    
    if (windowData) {
      const oldPriority = windowData.priority;
      windowData.priority = newPriority;
      
      errorLogger.info('rate_limit_priority_changed', `Priority changed for ${identifier}`, {
        ...context,
        identifier,
        oldPriority,
        newPriority
      });
    }
  }

  /**
   * Bulk operations for multiple keys
   */
  
  /**
   * Check multiple keys at once
   * @param {Array} keys - Array of keys to check
   * @param {string} priority - Default priority for all keys
   * @param {Object} context - Additional context
   * @returns {Object} Results for each key
   */
  checkMultiple(keys, priority = 'NORMAL', context = {}) {
    const results = {};
    
    keys.forEach(key => {
      results[key] = this.checkLimit(key, priority, {
        ...context,
        batchOperation: true,
        batchSize: keys.length
      });
    });
    
    return results;
  }

  /**
   * Reset multiple keys at once
   * @param {Array} keys - Array of keys to reset
   * @param {Object} context - Additional context
   */
  resetMultiple(keys, context = {}) {
    keys.forEach(key => {
      this.reset(key, {
        ...context,
        batchOperation: true,
        batchSize: keys.length
      });
    });
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up regular requests
    for (const [identifier, rateData] of this.requests.entries()) {
      if (now >= rateData.resetTime) {
        this.requests.delete(identifier);
      }
    }
    
    // Clean up request history
    for (const [identifier, history] of this.requestHistory.entries()) {
      const validHistory = history.filter(time => now - time < this.windowMs);
      if (validHistory.length === 0) {
        this.requestHistory.delete(identifier);
      } else {
        this.requestHistory.set(identifier, validHistory);
      }
    }
  }

  /**
   * Clean up sliding window for specific identifier
   * @param {string} identifier - Rate limit identifier
   * @param {number} now - Current timestamp
   */
  cleanupSlidingWindow(identifier, now) {
    const windowData = this.slidingWindows.get(identifier);
    if (windowData) {
      // Clean up regular requests
      windowData.requests = windowData.requests.filter(
        time => now - time < this.windowMs
      );
      
      // Clean up burst requests
      windowData.burstRequests = windowData.burstRequests.filter(
        time => now - time < this.burstWindow
      );
      
      // Remove empty windows to save memory
      if (windowData.requests.length === 0 && windowData.burstRequests.length === 0) {
        this.slidingWindows.delete(identifier);
      }
    }
  }

  /**
   * Get active rate limiters information
   * @returns {Array} Array of active limiter info
   */
  getActiveLimiters() {
    const now = Date.now();
    const activeLimiters = [];
    
    for (const [identifier, windowData] of this.slidingWindows.entries()) {
      const activeRequests = windowData.requests.filter(
        time => now - time < this.windowMs
      ).length;
      
      const burstCount = windowData.burstRequests.filter(
        time => now - time < this.burstWindow
      ).length;
      
      const priorityConfig = this.priorityConfigs[windowData.priority] || this.priorityConfigs.NORMAL;
      const effectiveLimit = priorityConfig.maxRequests;
      
      activeLimiters.push({
        identifier,
        priority: windowData.priority,
        currentRequests: activeRequests,
        effectiveLimit,
        remaining: Math.max(0, effectiveLimit - activeRequests),
        burstCount,
        burstLimit: this.burstLimit,
        resetTime: windowData.lastReset + this.windowMs,
        stats: windowData.stats
      });
    }
    
    return activeLimiters.sort((a, b) => b.currentRequests - a.currentRequests);
  }

  /**
   * Export rate limiting data for analysis
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  exportData(options = {}) {
    const {
      includeHistory = false,
      includeMetrics = true,
      format = 'json'
    } = options;
    
    const data = {
      metrics: includeMetrics ? this.getMetrics() : null,
      activeLimiters: this.getActiveLimiters(),
      timestamp: Date.now()
    };
    
    if (includeHistory) {
      data.windowData = Object.fromEntries(this.slidingWindows);
      data.requestData = Object.fromEntries(this.requestHistory);
    }
    
    return format === 'csv' ? this.convertToCSV(data) : data;
  }

  /**
   * Convert data to CSV format
   * @param {Object} data - Data to convert
   * @returns {string} CSV string
   */
  convertToCSV(data) {
    const limiterData = data.activeLimiters || [];
    const headers = ['identifier', 'priority', 'currentRequests', 'effectiveLimit', 'remaining', 'burstCount', 'burstLimit'];
    const rows = [headers.join(',')];
    
    limiterData.forEach(limiter => {
      const row = [
        limiter.identifier,
        limiter.priority,
        limiter.currentRequests,
        limiter.effectiveLimit,
        limiter.remaining,
        limiter.burstCount,
        limiter.burstLimit
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\n');
  }

  /**
   * Shutdown rate limiter and cleanup resources
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Log final metrics
    const finalMetrics = this.getMetrics();
    errorLogger.info('advanced_rate_limiter_shutdown', 'Advanced rate limiter shutting down', {
      finalMetrics
    });
    
    // Clear all data
    this.requests.clear();
    this.slidingWindows.clear();
    this.requestHistory.clear();
    
    // Reset metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      burstRequests: 0,
      averageWaitTime: 0,
      startTime: Date.now()
    };
  }

  /**
   * Create a rate limiter optimized for audio chunks
   * @param {Object} options - Configuration options
   * @returns {AdvancedRateLimiter} Configured rate limiter
   */
  static createAudioChunkLimiter(options = {}) {
    return new AdvancedRateLimiter({
      maxRequests: options.maxRequests || 10, // 10 chunks per second
      windowMs: 1000, // 1 second window
      burstLimit: options.burstLimit || 15, // Allow bursts of 15
      burstWindow: 2000, // 2 second burst window
      keyGenerator: (sessionId, userId) => `audio:${sessionId}:${userId}`,
      message: 'Audio chunk rate limit exceeded. Please slow down your speech.',
      ...options
    });
  }

  /**
   * Create a rate limiter optimized for WebSocket messages
   * @param {Object} options - Configuration options
   * @returns {AdvancedRateLimiter} Configured rate limiter
   */
  static createMessageLimiter(options = {}) {
    return new AdvancedRateLimiter({
      maxRequests: options.maxRequests || 50, // 50 messages per second
      windowMs: 1000, // 1 second window
      burstLimit: options.burstLimit || 100, // Allow bursts of 100
      burstWindow: 5000, // 5 second burst window
      keyGenerator: (socketId) => `message:${socketId}`,
      message: 'Message rate limit exceeded. Please wait before sending more messages.',
      ...options
    });
  }

  /**
   * Create a rate limiter optimized for connection attempts
   * @param {Object} options - Configuration options
   * @returns {AdvancedRateLimiter} Configured rate limiter
   */
  static createConnectionLimiter(options = {}) {
    return new AdvancedRateLimiter({
      maxRequests: options.maxRequests || 5, // 5 attempts per minute
      windowMs: 60000, // 1 minute window
      burstLimit: options.burstLimit || 10, // Allow bursts of 10
      burstWindow: 300000, // 5 minute burst window
      keyGenerator: (ipAddress) => `connection:${ipAddress}`,
      message: 'Too many connection attempts. Please wait before trying again.',
      ...options
    });
  }
}

export default AdvancedRateLimiter;
