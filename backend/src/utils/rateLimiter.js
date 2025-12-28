/**
 * RateLimiter - Production-grade rate limiting utility
 * Prevents spam and ensures fair resource usage
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 10; // Max requests per window
    this.windowMs = options.windowMs || 1000; // Time window in ms
    this.keyGenerator = options.keyGenerator || ((...args) => args.join(':'));
    this.message = options.message || 'Rate limit exceeded';
    
    // Store rate limit data: key -> { count, resetTime }
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if request is allowed
   * @param {string} key - Unique identifier for rate limit
   * @param {Object} context - Additional context for logging
   * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
   */
  checkLimit(key, context = {}) {
    const identifier = this.keyGenerator(key, context);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanup();
    
    let rateData = this.requests.get(identifier);
    
    // Initialize if new
    if (!rateData) {
      rateData = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.requests.set(identifier, rateData);
    }
    
    // Reset if window has passed
    if (now >= rateData.resetTime) {
      rateData.count = 0;
      rateData.resetTime = now + this.windowMs;
    }
    
    const allowed = rateData.count < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - rateData.count - (allowed ? 0 : 1));
    
    return {
      allowed,
      remaining,
      resetTime: rateData.resetTime,
      windowMs: this.windowMs,
      identifier
    };
  }

  /**
   * Consume one request from the limit
   * @param {string} key - Unique identifier for rate limit
   * @param {Object} context - Additional context for logging
   * @returns {Object} Rate limit result
   */
  consume(key, context = {}) {
    const result = this.checkLimit(key, context);
    
    if (result.allowed) {
      const rateData = this.requests.get(result.identifier);
      rateData.count += 1;
    }
    
    return result;
  }

  /**
   * Get current usage statistics
   * @param {string} key - Unique identifier
   * @returns {Object} Usage statistics
   */
  getStats(key, context = {}) {
    const identifier = this.keyGenerator(key, context);
    const rateData = this.requests.get(identifier);
    
    if (!rateData) {
      return {
        count: 0,
        remaining: this.maxRequests,
        resetTime: Date.now() + this.windowMs,
        windowMs: this.windowMs
      };
    }
    
    return {
      count: rateData.count,
      remaining: Math.max(0, this.maxRequests - rateData.count),
      resetTime: rateData.resetTime,
      windowMs: this.windowMs,
      identifier
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
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanup() {
    const now = Date.now();
    for (const [identifier, rateData] of this.requests.entries()) {
      if (now >= rateData.resetTime) {
        this.requests.delete(identifier);
      }
    }
  }

  /**
   * Shutdown rate limiter and cleanup resources
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }

  /**
   * Create a rate limiter for audio chunks
   * @param {Object} options - Configuration options
   * @returns {RateLimiter} Configured rate limiter
   */
  static createAudioChunkLimiter(options = {}) {
    return new RateLimiter({
      maxRequests: options.maxRequests || 10, // 10 chunks per second
      windowMs: 1000, // 1 second window
      keyGenerator: (sessionId, userId) => `audio:${sessionId}:${userId}`,
      message: 'Audio chunk rate limit exceeded. Please slow down your speech.',
      ...options
    });
  }

  /**
   * Create a rate limiter for WebSocket messages
   * @param {Object} options - Configuration options
   * @returns {RateLimiter} Configured rate limiter
   */
  static createMessageLimiter(options = {}) {
    return new RateLimiter({
      maxRequests: options.maxRequests || 50, // 50 messages per second
      windowMs: 1000, // 1 second window
      keyGenerator: (socketId) => `message:${socketId}`,
      message: 'Message rate limit exceeded. Please wait before sending more messages.',
      ...options
    });
  }

  /**
   * Create a rate limiter for connection attempts
   * @param {Object} options - Configuration options
   * @returns {RateLimiter} Configured rate limiter
   */
  static createConnectionLimiter(options = {}) {
    return new RateLimiter({
      maxRequests: options.maxRequests || 5, // 5 attempts per minute
      windowMs: 60000, // 1 minute window
      keyGenerator: (ipAddress) => `connection:${ipAddress}`,
      message: 'Too many connection attempts. Please wait before trying again.',
      ...options
    });
  }
}

export default RateLimiter;
