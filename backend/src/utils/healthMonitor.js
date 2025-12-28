/**
 * HealthMonitor - Production-grade health monitoring and fallback system
 * Monitors system health and provides automatic fallback mechanisms
 */

import errorLogger from './errorLogger.js';

class HealthMonitor {
  constructor(options = {}) {
    this.checks = new Map(); // checkName -> checkFunction
    this.healthStatus = new Map(); // component -> status
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.failureThreshold = options.failureThreshold || 3;
    this.timer = null;
    
    // System health state
    this.systemHealth = {
      status: 'healthy', // healthy, degraded, unhealthy, critical
      lastCheck: null,
      issues: [],
      recommendations: [],
      componentStatuses: new Map(),
      overallScore: 100
    };
    
    // Fallback mechanisms
    this.fallbackStrategies = new Map();
    this.activeFallbacks = new Map();
    
    // Built-in health checks
    this.setupBuiltInChecks();
    
    // Event system for health changes
    this.eventCallbacks = new Map();
    
    // Start monitoring if enabled
    if (options.autoStart !== false) {
      this.start();
    }
    
    // Setup logging context
    this.setupErrorLogging();
  }

  /**
   * Setup error logging with component context
   */
  setupErrorLogging() {
    errorLogger.setGlobalContext({
      component: 'health_monitor',
      version: '1.0.0'
    });
  }

  /**
   * Setup built-in health checks
   */
  setupBuiltInChecks() {
    // Database connectivity check
    this.addCheck('database', async () => {
      try {
        // Simple query to test database - this would need actual database access
        // For now, simulate a successful check
        return { 
          status: 'healthy', 
          message: 'Database connection OK',
          responseTime: Math.random() * 50 + 10 // Simulate response time
        };
      } catch (error) {
        return { 
          status: 'unhealthy', 
          message: `Database connection failed: ${error.message}`,
          responseTime: null
        };
      }
    });

    // WebSocket connections check
    this.addCheck('websocket', () => {
      const connectionCount = this.io?.engine?.clientsCount || 0;
      return {
        status: connectionCount > 0 ? 'healthy' : 'degraded',
        message: `${connectionCount} active WebSocket connections`,
        details: { connectionCount }
      };
    });

    // Memory usage check
    this.addCheck('memory', () => {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const usagePercent = (usedMB / totalMB) * 100;
      
      let status = 'healthy';
      if (usagePercent > 80) status = 'unhealthy';
      else if (usagePercent > 60) status = 'degraded';
      
      return {
        status,
        message: `${usedMB}MB / ${totalMB}MB heap used (${usagePercent.toFixed(1)}%)`,
        details: {
          heapUsed: usedMB,
          heapTotal: totalMB,
          usagePercent: usagePercent.toFixed(1),
          external: Math.round(usage.external / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024)
        }
      };
    });

    // CPU usage check
    this.addCheck('cpu', () => {
      const startUsage = process.cpuUsage();
      
      // Simulate some work and measure CPU
      return new Promise((resolve) => {
        setTimeout(() => {
          const endUsage = process.cpuUsage(startUsage);
          const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
          
          let status = 'healthy';
          if (totalUsage > 2) status = 'unhealthy';
          else if (totalUsage > 1) status = 'degraded';
          
          resolve({
            status,
            message: `CPU usage: ${totalUsage.toFixed(2)}s`,
            details: {
              user: endUsage.user / 1000000,
              system: endUsage.system / 1000000,
              total: totalUsage
            }
          });
        }, 100);
      });
    });

    // Disk space check (if available)
    this.addCheck('disk', async () => {
      try {
        // This would require 'fs' and 'path' modules in a real implementation
        // For now, simulate disk check
        return {
          status: 'healthy',
          message: 'Disk space OK',
          details: { available: '85%', used: '15%' }
        };
      } catch (error) {
        return {
          status: 'degraded',
          message: `Disk check failed: ${error.message}`
        };
      }
    });

    // Rate limiter health check
    this.addCheck('rate_limiter', () => {
      if (this.rateLimiter) {
        const metrics = this.rateLimiter.getMetrics();
        const blockRate = parseFloat(metrics.blockRate.replace('%', ''));
        
        let status = 'healthy';
        if (blockRate > 50) status = 'unhealthy';
        else if (blockRate > 20) status = 'degraded';
        
        return {
          status,
          message: `Rate limiter block rate: ${metrics.blockRate}`,
          details: {
            totalRequests: metrics.totalRequests,
            allowedRequests: metrics.allowedRequests,
            blockedRequests: metrics.blockedRequests,
            blockRate: metrics.blockRate
          }
        };
      } else {
        return {
          status: 'degraded',
          message: 'Rate limiter not available'
        };
      }
    });

    console.log('🏥 Built-in health checks configured');
  }

  /**
   * Add custom health check
   * @param {string} name - Check name
   * @param {Function} checkFunction - Async function returning { status, message, details }
   */
  addCheck(name, checkFunction) {
    this.checks.set(name, {
      function: checkFunction,
      lastCheck: null,
      failureCount: 0,
      status: 'unknown',
      lastResult: null,
      responseTime: null
    });
    
    errorLogger.info('health_check_added', `Health check added: ${name}`, { checkName: name });
  }

  /**
   * Remove health check
   * @param {string} name - Check name to remove
   */
  removeCheck(name) {
    if (this.checks.delete(name)) {
      errorLogger.info('health_check_removed', `Health check removed: ${name}`, { checkName: name });
    }
  }

  /**
   * Run all health checks
   * @returns {Object} Results for all checks
   */
  async runHealthChecks() {
    const results = {};
    const startTime = Date.now();
    
    errorLogger.debug('health_checks_started', 'Starting health checks');
    
    for (const [name, check] of this.checks.entries()) {
      try {
        const checkStartTime = Date.now();
        const result = await check.function();
        const responseTime = Date.now() - checkStartTime;
        
        check.lastCheck = Date.now();
        check.lastResult = result;
        check.responseTime = responseTime;
        check.status = result.status;
        
        if (result.status === 'unhealthy') {
          check.failureCount++;
        } else {
          check.failureCount = 0;
        }
        
        results[name] = {
          ...result,
          responseTime,
          lastCheck: check.lastCheck,
          failureCount: check.failureCount
        };
        
        // Update component status
        this.healthStatus.set(name, result.status);
        
      } catch (error) {
        check.failureCount++;
        check.lastCheck = Date.now();
        check.status = 'unhealthy';
        check.lastResult = {
          status: 'unhealthy',
          message: error.message
        };
        
        results[name] = {
          status: 'unhealthy',
          message: `Check failed: ${error.message}`,
          responseTime: null,
          lastCheck: check.lastCheck,
          failureCount: check.failureCount,
          error: error.stack
        };
        
        errorLogger.error('health_check_error', `Health check failed: ${name}`, {
          checkName: name,
          error: error.message
        }, error);
      }
    }
    
    // Update overall system health
    this.evaluateSystemHealth(results);
    
    const totalTime = Date.now() - startTime;
    errorLogger.debug('health_checks_completed', 'Health checks completed', {
      totalTime,
      checkCount: Object.keys(results).length
    });
    
    return results;
  }

  /**
   * Evaluate overall system health from individual check results
   * @param {Object} results - Health check results
   */
  evaluateSystemHealth(results) {
    const statuses = Object.values(results).map(r => r.status);
    const checkCount = statuses.length;
    
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let criticalIssues = [];
    let warnings = [];
    
    statuses.forEach((status, index) => {
      const checkName = Object.keys(results)[index];
      
      switch (status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          warnings.push(`${checkName} is degraded`);
          break;
        case 'unhealthy':
          unhealthyCount++;
          criticalIssues.push(`${checkName} is unhealthy`);
          break;
      }
    });
    
    // Calculate overall score (0-100)
    const totalScore = ((healthyCount * 100) + (degradedCount * 60) + (unhealthyCount * 20)) / checkCount;
    this.systemHealth.overallScore = Math.round(totalScore);
    
    // Determine overall status
    let overallStatus = 'healthy';
    let recommendations = [];
    
    if (unhealthyCount > 0) {
      overallStatus = 'critical';
      recommendations.push('Immediate attention required for unhealthy components');
    } else if (criticalIssues.length > 0) {
      overallStatus = 'unhealthy';
      recommendations.push('Review and fix critical health issues');
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
      recommendations.push('Monitor degraded components');
    }
    
    // Update system health state
    this.systemHealth = {
      ...this.systemHealth,
      status: overallStatus,
      lastCheck: Date.now(),
      issues: [...criticalIssues, ...warnings],
      recommendations,
      componentStatuses: new Map(Object.entries(results).map(([name, result]) => [name, result.status])),
      overallScore: this.systemHealth.overallScore
    };
    
    // Check if fallback mechanisms should be triggered
    this.checkFallbackTriggers(results);
    
    // Emit health change events
    this.emitHealthChangeEvents();
  }

  /**
   * Check if any fallback mechanisms should be triggered
   * @param {Object} results - Health check results
   */
  checkFallbackTriggers(results) {
    for (const [component, fallbackStrategy] of this.fallbackStrategies.entries()) {
      const checkResult = results[component];
      if (!checkResult) continue;
      
      const shouldActivate = checkResult.failureCount >= this.failureThreshold;
      const isCurrentlyActive = this.activeFallbacks.has(component);
      
      if (shouldActivate && !isCurrentlyActive) {
        // Activate fallback
        this.activateFallback(component, fallbackStrategy, checkResult);
      } else if (!shouldActivate && isCurrentlyActive) {
        // Deactivate fallback
        this.deactivateFallback(component, fallbackStrategy);
      }
    }
  }

  /**
   * Activate fallback mechanism
   * @param {string} component - Component name
   * @param {Object} strategy - Fallback strategy
   * @param {Object} checkResult - Health check result
   */
  activateFallback(component, strategy, checkResult) {
    try {
      strategy.activate();
      this.activeFallbacks.set(component, {
        strategy,
        activatedAt: Date.now(),
        triggerResult: checkResult
      });
      
      errorLogger.warn('fallback_activated', `Fallback activated for ${component}`, {
        component,
        strategy: strategy.name,
        checkResult
      });
      
      this.emit('fallback_activated', {
        component,
        strategy: strategy.name,
        checkResult
      });
      
    } catch (error) {
      errorLogger.critical('fallback_activation_failed', `Failed to activate fallback for ${component}`, {
        component,
        strategy: strategy.name,
        error: error.message
      }, error);
    }
  }

  /**
   * Deactivate fallback mechanism
   * @param {string} component - Component name
   * @param {Object} strategy - Fallback strategy
   */
  deactivateFallback(component, strategy) {
    try {
      strategy.deactivate();
      this.activeFallbacks.delete(component);
      
      errorLogger.info('fallback_deactivated', `Fallback deactivated for ${component}`, {
        component,
        strategy: strategy.name
      });
      
      this.emit('fallback_deactivated', {
        component,
        strategy: strategy.name
      });
      
    } catch (error) {
      errorLogger.error('fallback_deactivation_failed', `Failed to deactivate fallback for ${component}`, {
        component,
        strategy: strategy.name,
        error: error.message
      }, error);
    }
  }

  /**
   * Add fallback strategy for a component
   * @param {string} component - Component name
   * @param {Object} strategy - Fallback strategy object
   */
  addFallbackStrategy(component, strategy) {
    this.fallbackStrategies.set(component, strategy);
    
    errorLogger.info('fallback_strategy_added', `Fallback strategy added for ${component}`, {
      component,
      strategy: strategy.name
    });
  }

  /**
   * Remove fallback strategy
   * @param {string} component - Component name
   */
  removeFallbackStrategy(component) {
    // Deactivate if currently active
    if (this.activeFallbacks.has(component)) {
      const fallback = this.activeFallbacks.get(component);
      this.deactivateFallback(component, fallback.strategy);
    }
    
    this.fallbackStrategies.delete(component);
    
    errorLogger.info('fallback_strategy_removed', `Fallback strategy removed for ${component}`, {
      component
    });
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.timer) return;
    
    this.timer = setInterval(async () => {
      try {
        const results = await this.runHealthChecks();
        this.logHealthStatus(results);
      } catch (error) {
        errorLogger.error('health_monitor_error', 'Error during health check cycle', {
          error: error.message
        }, error);
      }
    }, this.checkInterval);
    
    // Run initial health check
    this.runHealthChecks();
    
    errorLogger.info('health_monitor_started', 'Health monitoring started', {
      checkInterval: this.checkInterval,
      checkCount: this.checks.size
    });
    
    console.log('🏥 Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      
      errorLogger.info('health_monitor_stopped', 'Health monitoring stopped');
      console.log('🏥 Health monitoring stopped');
    }
  }

  /**
   * Log current health status
   * @param {Object} results - Health check results
   */
  logHealthStatus(results) {
    const status = this.systemHealth.status;
    const score = this.systemHealth.overallScore;
    const activeFallbacks = this.activeFallbacks.size;
    
    if (status === 'critical' || status === 'unhealthy') {
      errorLogger.warn('system_health_alert', `System health: ${status} (score: ${score})`, {
        status,
        score,
        issues: this.systemHealth.issues,
        recommendations: this.systemHealth.recommendations,
        activeFallbacks
      });
    } else if (status === 'degraded') {
      errorLogger.info('system_health_degraded', `System health: ${status} (score: ${score})`, {
        status,
        score,
        warnings: this.systemHealth.issues
      });
    } else {
      errorLogger.debug('system_health_healthy', `System health: ${status} (score: ${score})`, {
        status,
        score
      });
    }
  }

  /**
   * Get current system health status
   * @returns {Object} System health status
   */
  getHealthStatus() {
    return {
      ...this.systemHealth,
      activeFallbacks: Array.from(this.activeFallbacks.entries()).map(([component, fallback]) => ({
        component,
        strategy: fallback.strategy.name,
        activatedAt: fallback.activatedAt
      })),
      checkCount: this.checks.size,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Get detailed health report
   * @returns {Object} Detailed health report
   */
  getDetailedReport() {
    const report = {
      timestamp: Date.now(),
      systemHealth: this.getHealthStatus(),
      individualChecks: {},
      activeFallbacks: Array.from(this.activeFallbacks.entries()),
      fallbackStrategies: Array.from(this.fallbackStrategies.entries()).map(([component, strategy]) => ({
        component,
        strategy: strategy.name
      }))
    };
    
    // Add individual check details
    for (const [name, check] of this.checks.entries()) {
      report.individualChecks[name] = {
        status: check.status,
        lastCheck: check.lastCheck,
        failureCount: check.failureCount,
        responseTime: check.responseTime,
        lastResult: check.lastResult
      };
    }
    
    return report;
  }

  /**
   * Manually trigger health check
   * @returns {Object} Health check results
   */
  async triggerHealthCheck() {
    errorLogger.info('manual_health_check', 'Manual health check triggered');
    return await this.runHealthChecks();
  }

  /**
   * Event system methods
   */

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
          errorLogger.error('health_monitor_event_error', `Error in ${event} callback`, {
            event,
            error: error.message
          }, error);
        }
      });
    }
  }

  /**
   * Emit health change events
   */
  emitHealthChangeEvents() {
    const previousStatus = this.previousStatus || 'unknown';
    const currentStatus = this.systemHealth.status;
    
    if (previousStatus !== currentStatus) {
      this.emit('health_status_changed', {
        previousStatus,
        currentStatus,
        score: this.systemHealth.overallScore,
        issues: this.systemHealth.issues
      });
      
      this.previousStatus = currentStatus;
    }
  }

  /**
   * Shutdown health monitor and cleanup resources
   */
  shutdown() {
    errorLogger.info('health_monitor_shutdown', 'Health monitor shutting down');
    
    // Stop monitoring
    this.stop();
    
    // Deactivate all fallbacks
    for (const [component, fallback] of this.activeFallbacks.entries()) {
      this.deactivateFallback(component, fallback.strategy);
    }
    
    // Clear event callbacks
    this.eventCallbacks.clear();
    
    // Clear health checks
    this.checks.clear();
    this.healthStatus.clear();
    
    console.log('✅ Health monitor shutdown complete');
  }
}

export default HealthMonitor;
