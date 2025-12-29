import { prisma } from '../prismaClient.js';
import TranslationAgent from '../agents/translationAgent.js';
import SummarizationAgent from '../agents/summarizationAgent.js';
import { verifyToken } from '../utils/jwt.js';
import AudioChunkHandler from './audioChunkHandler.js';
import translationConfig from '../config/translationConfig.js';
import errorLogger from '../utils/errorLogger.js';
import AdvancedRateLimiter from '../utils/enhancedRateLimiter.js';
import HealthMonitor from '../utils/healthMonitor.js';

// Initialize summarization agent
const summarizationAgent = new SummarizationAgent();

class SocketHandler {
  constructor(io) {
    this.io = io;

    this.connectedUsers = new Map();
    this.sessionUsers = new Map();
    this.userLanguagePreferences = new Map();
    this.liveCaptionIntervals = new Map();
    this.connectionContexts = new Map();
    this.disconnectReasons = new Map();

    this.setupErrorLogging();

    this.audioRateLimiter = AdvancedRateLimiter.createAudioChunkLimiter({
      maxRequests: 10,
      burstLimit: 15,
      burstWindow: 2000
    });

    this.translationAgent = new TranslationAgent(translationConfig.agent);

    // 🔥 AudioChunkHandler OWNS the TranscriptionAgent instance
    this.audioChunkHandler = new AudioChunkHandler(io, {
      chunkBufferSize: 10,
      maxChunkSize: 1024 * 1024,
      processingTimeout: 30000,
      enableDebugLogging: true
    });

    this.setupHealthMonitoring();

    errorLogger.info(
      'socket_handler_initialized',
      'SocketHandler initialized',
      { features: ['error_logging', 'rate_limiting', 'health_monitoring'] }
    );
  }

  /* ================= HEALTH MONITORING ================= */

  setupHealthMonitoring() {
    this.healthMonitor = new HealthMonitor({
      checkInterval: 30000,
      failureThreshold: 3,
      autoStart: true
    });

    this.healthMonitor.addCheck('socket_connections', () => {
      const activeConnections = this.connectedUsers.size;
      const activeSessions = this.sessionUsers.size;

      let status = 'healthy';
      if (activeConnections === 0 && activeSessions === 0) status = 'degraded';
      if (activeConnections > 500) status = 'degraded';
      if (activeConnections > 1000) status = 'unhealthy';

      return {
        status,
        message: `${activeConnections} users, ${activeSessions} sessions`,
        details: { activeConnections, activeSessions }
      };
    });

    this.healthMonitor.on('health_status_changed', (data) => {
      console.log(`🏥 Health: ${data.previousStatus} → ${data.currentStatus}`);

      if (['critical', 'unhealthy'].includes(data.currentStatus)) {
        this.io.emit('system_health_alert', {
          status: data.currentStatus,
          score: data.score,
          issues: data.issues,
          timestamp: Date.now()
        });
      }
    });

    this.healthMonitor.on('fallback_activated', (data) => {
      console.warn(`🔄 Fallback activated: ${data.component}`);
      this.io.emit('service_degraded', data);
    });
  }

  /* ================= ERROR LOGGING ================= */

  setupErrorLogging() {
    errorLogger.setGlobalContext({
      component: 'socket_handler',
      serverId: this.io?.id || 'unknown'
    });
  }

  /* ================= INITIALIZATION ================= */

  async initialize() {
    await this.translationAgent.initialize();
    await this.audioChunkHandler.initialize();

    this.setupTranslationEventHandlers();
    this.initializeConnectionHandlers();

    console.log('✅ SocketHandler fully initialized');
  }

  /* ================= EVENT BRIDGE ================= */

  setupTranslationEventHandlers() {
    const transcriptionAgent = this.audioChunkHandler.transcriptionAgent;

    if (!transcriptionAgent || typeof transcriptionAgent.on !== 'function') {
      throw new Error('❌ TranscriptionAgent is not an EventEmitter instance');
    }

    // 🎤 Transcription → Translation
    transcriptionAgent.on('transcription:partial', async (data) => {
      await this.translationAgent.processTranscription(data.sessionId, data);
    });

    // 🌍 Translation → Frontend
    this.translationAgent.on('translation:partial', (data) => {
      this.io.to(data.sessionId).emit('translation:partial', data);
    });

    this.translationAgent.on('translation:error', (err) => {
      this.io.to(err.sessionId).emit('translation:error', err);
    });
  }

  /* ================= SOCKET CONNECTIONS ================= */

  initializeConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Connected: ${socket.id}`);

      socket.on('authenticate', ({ token }) => {
        const decoded = verifyToken(token);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        this.connectedUsers.set(decoded.id, socket.id);
        socket.emit('authenticated', decoded);
      });

      socket.on('disconnect', async (reason) => {
        console.log(`❌ Disconnected: ${socket.id} (${reason})`);
        await this.audioChunkHandler.handleDisconnect(socket);
        this.connectedUsers.delete(socket.userId);
      });
    });
  }

  /* ================= SHUTDOWN ================= */

  async shutdown() {
    if (this.healthMonitor) this.healthMonitor.stop();
    if (this.translationAgent) await this.translationAgent.shutdown();
    console.log('🛑 SocketHandler shutdown complete');
  }
}

export default SocketHandler;
