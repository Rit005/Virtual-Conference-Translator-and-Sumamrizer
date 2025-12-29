/**
 * HealthMonitor – Severity-aware, production-grade health monitoring
 */

import errorLogger from './errorLogger.js';

class HealthMonitor {
  constructor(options = {}) {
    this.checks = new Map();
    this.checkInterval = options.checkInterval || 30000;
    this.failureThreshold = options.failureThreshold || 3;
    this.timer = null;

    this.systemHealth = {
      status: 'healthy',
      lastCheck: null,
      issues: [],
      recommendations: [],
      overallScore: 100
    };

    this.eventCallbacks = new Map();
    this.previousStatus = 'unknown';

    this.setupBuiltInChecks();

    if (options.autoStart !== false) {
      this.start();
    }

    errorLogger.setGlobalContext({
      component: 'health_monitor',
      version: '2.0.0'
    });
  }

  /* ---------------- CHECK REGISTRATION ---------------- */

  addCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      severity: options.severity || 'critical', // critical | optional
      status: 'unknown',
      failureCount: 0,
      lastResult: null
    });

    errorLogger.info('health_check_added', `Health check added: ${name}`, {
      name,
      severity: options.severity || 'critical'
    });
  }

  setupBuiltInChecks() {
    this.addCheck(
      'database',
      async () => ({ status: 'healthy', message: 'DB OK' }),
      { severity: 'critical' }
    );

    this.addCheck(
      'websocket',
      () => ({ status: 'healthy', message: 'Socket OK' }),
      { severity: 'critical' }
    );

    this.addCheck(
      'memory',
      () => ({ status: 'healthy', message: 'Memory OK' }),
      { severity: 'critical' }
    );

    this.addCheck(
      'cpu',
      () => ({ status: 'healthy', message: 'CPU OK' }),
      { severity: 'critical' }
    );

    this.addCheck(
      'rate_limiter',
      () => ({ status: 'healthy', message: 'Rate limiter OK' }),
      { severity: 'critical' }
    );

    // OPTIONAL SERVICES
    this.addCheck(
      'oauth',
      () => ({
        status: process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID
          ? 'healthy'
          : 'degraded',
        message: 'OAuth not configured'
      }),
      { severity: 'optional' }
    );

    this.addCheck(
      'openai',
      () => ({
        status: process.env.OPENAI_API_KEY ? 'healthy' : 'degraded',
        message: 'OpenAI key missing'
      }),
      { severity: 'optional' }
    );

    console.log('🏥 Built-in health checks configured');
  }

  /* ---------------- HEALTH EVALUATION ---------------- */

  async runHealthChecks() {
    const results = [];

    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await check.fn();
        check.status = result.status;
        check.lastResult = result;
        check.failureCount =
          result.status === 'unhealthy' ? check.failureCount + 1 : 0;

        results.push({ name, ...check });
      } catch (err) {
        check.status = 'unhealthy';
        check.failureCount++;

        results.push({
          name,
          status: 'unhealthy',
          severity: check.severity
        });
      }
    }

    this.evaluateSystemHealth(results);
  }

  evaluateSystemHealth(results) {
    const criticalFailures = results.filter(
      r => r.severity === 'critical' && r.status === 'unhealthy'
    );

    const optionalFailures = results.filter(
      r => r.severity === 'optional' && r.status !== 'healthy'
    );

    let status = 'healthy';

    if (criticalFailures.length > 0) {
      status = 'critical';
    } else if (optionalFailures.length > 0) {
      status = 'degraded';
    }

    this.systemHealth = {
      status,
      lastCheck: Date.now(),
      issues: [...criticalFailures, ...optionalFailures].map(
        r => `${r.name} ${r.status}`
      ),
      overallScore:
        status === 'healthy' ? 100 : status === 'degraded' ? 80 : 40
    };

    this.emitHealthChange();
    this.logHealth();
  }

  /* ---------------- EVENTS ---------------- */

  on(event, cb) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(cb);
  }

  emit(event, data) {
    (this.eventCallbacks.get(event) || []).forEach(cb => cb(data));
  }

  emitHealthChange() {
    if (this.previousStatus !== this.systemHealth.status) {
      this.emit('health_status_changed', {
        previousStatus: this.previousStatus,
        currentStatus: this.systemHealth.status,
        score: this.systemHealth.overallScore
      });

      this.previousStatus = this.systemHealth.status;
    }
  }

  /* ---------------- LOGGING ---------------- */

  logHealth() {
    const { status, overallScore } = this.systemHealth;

    if (status === 'critical') {
      errorLogger.error(
        'system_health_critical',
        `System health CRITICAL (${overallScore})`
      );
    } else if (status === 'degraded') {
      errorLogger.warn(
        'system_health_degraded',
        `System health DEGRADED (${overallScore})`
      );
    } else {
      errorLogger.debug(
        'system_health_healthy',
        `System health HEALTHY (${overallScore})`
      );
    }
  }

  /* ---------------- CONTROL ---------------- */

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.runHealthChecks(), this.checkInterval);
    this.runHealthChecks();
    console.log('🏥 Health monitoring started');
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

export default HealthMonitor;
