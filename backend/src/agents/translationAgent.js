/**
 * Production TranslationAgent for Real-time Transcription Translation
 * 
 * Features:
 * - Receives transcription text from TranscriptionAgentRefined
 * - Translates text into user-selected language with real-time capability
 * - Supports dynamic language switching per session
 * - Integrates with GPT-4/Claude/translation APIs
 * - Emits translated captions in real-time
 * - Stateless design with clean function boundaries
 * - Easy extensibility for more languages
 * 
 * Event Flow:
 * 1. Listen to: transcription:partial (from TranscriptionAgentRefined)
 * 2. Process: Translate text based on session language preferences
 * 3. Emit: translation:partial (for real-time translated captions)
 * 4. Support: translation:error, translation:completed events
 */

import { EventEmitter } from 'events';
import OpenAIProvider from '../services/translationProviders/openaiProvider.js';
import ClaudeProvider from '../services/translationProviders/claudeProvider.js';
import MockProvider from '../services/translationProviders/mockProvider.js';

class TranslationAgent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Core configuration
    this.config = {
      // Translation settings
      defaultProvider: options.defaultProvider || 'mock',
      enableCaching: options.enableCaching !== false,
      cacheSize: options.cacheSize || 1000,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      
      // Processing settings
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      maxTextLength: options.maxTextLength || 10000,
      
      // Real-time settings
      realTimeThreshold: options.realTimeThreshold || 500, // 500ms for real-time
      enableStreaming: options.enableStreaming !== false,
      
      // Debug
      enableDebugLogging: options.enableDebugLogging || false
    };

    // Translation providers
    this.providers = {
      openai: new OpenAIProvider(options.openai || {}),
      claude: new ClaudeProvider(options.claude || {}),
      mock: new MockProvider(options.mock || {})
    };

    // Core state
    this.activeSessions = new Map(); // sessionId -> SessionState
    this.isInitialized = false;
    this.cache = new Map(); // translation cache

    // Statistics
    this.stats = {
      totalSessions: 0,
      totalTranslations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      averageProcessingTime: 0,
      providerUsage: {}
    };
  }

  /**
   * Initialize the TranslationAgent
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    try {
      this.log('Initializing TranslationAgent...');
      
      // Initialize default provider
      const defaultProvider = this.providers[this.config.defaultProvider];
      if (!defaultProvider) {
        throw new Error(`Unknown default provider: ${this.config.defaultProvider}`);
      }

      const providerInitialized = await defaultProvider.initialize();
      if (!providerInitialized) {
        throw new Error(`Failed to initialize default provider: ${this.config.defaultProvider}`);
      }

      // Initialize other providers
      const initPromises = Object.entries(this.providers).map(async ([name, provider]) => {
        if (name !== this.config.defaultProvider) {
          try {
            await provider.initialize();
          } catch (error) {
            this.log(`Warning: Failed to initialize provider ${name}:`, error.message);
          }
        }
      });

      await Promise.all(initPromises);

      this.isInitialized = true;
      this.log('TranslationAgent initialized successfully');
      return true;
    } catch (error) {
      this.log('Failed to initialize TranslationAgent:', error.message);
      return false;
    }
  }

  /**
   * Start a new translation session
   * @param {string} sessionId - Conference session identifier
   * @param {Object} options - Session options
   * @returns {Promise<Object>} Session result
   */
  async startSession(sessionId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('TranslationAgent not initialized');
    }

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Clean up existing session if it exists
    if (this.activeSessions.has(sessionId)) {
      await this.stopSession(sessionId);
    }

    try {
      this.log(`Starting translation session: ${sessionId}`);

      const sessionState = {
        sessionId,
        startTime: Date.now(),
        isActive: true,
        
        // Language configuration
        targetLanguage: options.targetLanguage || 'en',
        sourceLanguage: options.sourceLanguage || 'auto',
        languagePreferences: options.languagePreferences || {},
        
        // Provider configuration
        preferredProvider: options.provider || this.config.defaultProvider,
        fallbackProviders: options.fallbackProviders || ['mock'],
        
        // Processing state
        isProcessing: false,
        retryCount: 0,
        lastLanguageChange: Date.now(),
        
        // Statistics
        translationsReceived: 0,
        translationsProcessed: 0,
        errorsCount: 0,
        lastActivity: Date.now()
      };

      this.activeSessions.set(sessionId, sessionState);
      this.stats.totalSessions++;

      // Emit session started event
      this.emit('translation:session:started', {
        sessionId,
        targetLanguage: sessionState.targetLanguage,
        provider: sessionState.preferredProvider,
        timestamp: new Date()
      });

      this.log(`Translation session started: ${sessionId}`);

      return {
        success: true,
        sessionId,
        targetLanguage: sessionState.targetLanguage,
        provider: sessionState.preferredProvider,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Failed to start session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Process incoming transcription for translation
   * @param {string} sessionId - Conference session identifier
   * @param {Object} transcriptionData - Transcription data from TranscriptionAgentRefined
   * @returns {Promise<Object>} Processing result
   */
  async processTranscription(sessionId, transcriptionData) {
    if (!this.isInitialized) {
      throw new Error('TranslationAgent not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateTranscriptionInput(sessionId, transcriptionData);

      // Get or create session
      let session = this.activeSessions.get(sessionId);
      if (!session) {
        this.log(`Creating new session for transcription: ${sessionId}`);
        await this.startSession(sessionId, {
          targetLanguage: transcriptionData.language || 'en'
        });
        session = this.activeSessions.get(sessionId);
      }

      if (!session.isActive) {
        throw new Error(`Session ${sessionId} is not active`);
      }

      // Extract transcription data
      const { text, language, confidence, isFinal, chunkCount, processingTime } = transcriptionData;
      
      // Skip if text is empty or too short
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          sessionId,
          skipped: true,
          reason: 'empty_text',
          timestamp: new Date()
        };
      }

      // Check cache first (if enabled)
      const cacheKey = this.generateCacheKey(text, session.sourceLanguage, session.targetLanguage);
      let translationResult;

      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        translationResult = this.cache.get(cacheKey);
        this.log(`Cache hit for translation: "${text.substring(0, 30)}..."`);
      } else {
        this.stats.cacheMisses++;
        
        // Perform translation with retry logic
        translationResult = await this.translateWithRetry(sessionId, text, {
          sourceLanguage: language || session.sourceLanguage,
          targetLanguage: session.targetLanguage,
          confidence,
          isFinal
        });
        
        // Cache the result
        if (this.config.enableCaching) {
          this.cache.set(cacheKey, translationResult);
          this.cleanupCache();
        }
      }

      // Update session statistics
      session.translationsReceived++;
      session.translationsProcessed++;
      session.lastActivity = Date.now();

      // Emit translation result event (key requirement)
      this.emit('translation:partial', {
        sessionId,
        originalText: text,
        translatedText: translationResult.translatedText,
        sourceLanguage: translationResult.sourceLanguage,
        targetLanguage: translationResult.targetLanguage,
        confidence: translationResult.confidence,
        provider: translationResult.provider,
        isFinal,
        chunkCount,
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      });

      // Update stats
      this.stats.totalTranslations++;
      this.updateProviderStats(translationResult.provider);

      const processingTimeTotal = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTimeTotal);

      this.log(`Translation completed for session ${sessionId}: "${text.substring(0, 30)}..." → "${translationResult.translatedText.substring(0, 30)}..."`);

      return {
        success: true,
        sessionId,
        originalText: text,
        translatedText: translationResult.translatedText,
        confidence: translationResult.confidence,
        provider: translationResult.provider,
        processingTime: processingTimeTotal,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Translation failed for session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      
      // Update session error count
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.errorsCount++;
        session.lastActivity = Date.now();
      }
      
      // Emit error event
      this.emit('translation:error', {
        sessionId,
        error: error.message,
        originalText: transcriptionData.text,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Switch target language for active session
   * @param {string} sessionId - Conference session identifier
   * @param {string} newLanguage - New target language code
   * @returns {Promise<Object>} Language switch result
   */
  async switchLanguage(sessionId, newLanguage) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.isActive) {
      throw new Error(`Session ${sessionId} is not active`);
    }

    const oldLanguage = session.targetLanguage;
    session.targetLanguage = newLanguage;
    session.lastLanguageChange = Date.now();

    this.log(`Language switched for session ${sessionId}: ${oldLanguage} → ${newLanguage}`);

    // Emit language change event
    this.emit('translation:language:changed', {
      sessionId,
      oldLanguage,
      newLanguage,
      timestamp: new Date()
    });

    return {
      success: true,
      sessionId,
      oldLanguage,
      newLanguage,
      timestamp: new Date()
    };
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported language objects
   */
  getSupportedLanguages() {
    // Get languages from default provider
    const defaultProvider = this.providers[this.config.defaultProvider];
    return defaultProvider.getSupportedLanguages();
  }

  /**
   * Get session status
   * @param {string} sessionId - Conference session identifier
   * @returns {Object} Session status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        active: false,
        sessionId,
        message: 'Session not found'
      };
    }

    return {
      active: session.isActive,
      sessionId,
      targetLanguage: session.targetLanguage,
      sourceLanguage: session.sourceLanguage,
      provider: session.preferredProvider,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      translationsReceived: session.translationsReceived,
      translationsProcessed: session.translationsProcessed,
      errorsCount: session.errorsCount,
      lastActivity: session.lastActivity,
      lastLanguageChange: session.lastLanguageChange
    };
  }

  /**
   * Get all active sessions
   * @returns {Array<Object>} Array of session statuses
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...this.getSessionStatus(sessionId)
    }));
  }

  /**
   * Stop a translation session
   * @param {string} sessionId - Conference session identifier
   * @returns {Promise<Object>} Stop result
   */
  async stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.log(`Session ${sessionId} not found for stopping`);
      return { success: false, error: 'Session not found' };
    }

    try {
      this.log(`Stopping translation session: ${sessionId}`);

      // Calculate session statistics
      const sessionStats = this.calculateSessionStats(session);
      
      // Clean up session
      this.cleanupSession(sessionId);

      // Emit session stopped event
      this.emit('translation:session:stopped', {
        sessionId,
        stats: sessionStats,
        timestamp: new Date()
      });

      this.log(`Translation session stopped: ${sessionId}`, sessionStats);

      return {
        success: true,
        sessionId,
        stats: sessionStats,
        timestamp: new Date()
      };

    } catch (error) {
      this.log(`Failed to stop session ${sessionId}:`, error.message);
      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Get agent statistics
   * @returns {Object} Agent statistics
   */
  getStats() {
    const activeSessionCount = this.activeSessions.size;
    const cacheHitRate = this.stats.cacheHits + this.stats.cacheMisses > 0 
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 
      : 0;

    return {
      ...this.stats,
      activeSessions: activeSessionCount,
      isInitialized: this.isInitialized,
      cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
      availableProviders: Object.keys(this.providers)
    };
  }

  /**
   * Shutdown the TranslationAgent
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.log('Shutting down TranslationAgent...');

    try {
      // Stop all active sessions
      const sessionIds = Array.from(this.activeSessions.keys());
      await Promise.all(sessionIds.map(sessionId => this.stopSession(sessionId)));

      // Cleanup providers
      await Promise.all(Object.values(this.providers).map(provider => 
        provider.cleanup ? provider.cleanup() : Promise.resolve()
      ));

      // Clear cache
      this.cache.clear();

      this.isInitialized = false;
      this.log('TranslationAgent shutdown complete');

    } catch (error) {
      this.log('Error during TranslationAgent shutdown:', error.message);
    }
  }

  // Private helper methods

  /**
   * Validate transcription input parameters
   */
  validateTranscriptionInput(sessionId, transcriptionData) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Valid sessionId is required');
    }

    if (!transcriptionData || typeof transcriptionData !== 'object') {
      throw new Error('Valid transcription data is required');
    }

    if (!transcriptionData.text || typeof transcriptionData.text !== 'string') {
      throw new Error('Valid text is required in transcription data');
    }

    if (transcriptionData.text.length > this.config.maxTextLength) {
      throw new Error(`Text length ${transcriptionData.text.length} exceeds maximum ${this.config.maxTextLength}`);
    }
  }

  /**
   * Translate text with retry logic
   */
  async translateWithRetry(sessionId, text, options) {
    const session = this.activeSessions.get(sessionId);
    const startTime = Date.now();
    
    // Try preferred provider first, then fallbacks
    const providersToTry = [session.preferredProvider, ...session.fallbackProviders];
    let lastError;

    for (const providerName of providersToTry) {
      const provider = this.providers[providerName];
      if (!provider) {
        this.log(`Provider ${providerName} not available, skipping...`);
        continue;
      }

      try {
        this.log(`Translating with provider ${providerName} for session ${sessionId}`);

        const result = await provider.translate(text, {
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage,
          confidence: options.confidence,
          isFinal: options.isFinal
        });

        // Add provider info to result
        result.provider = providerName;
        result.processingTime = Date.now() - startTime;

        return result;

      } catch (error) {
        lastError = error;
        this.log(`Provider ${providerName} failed:`, error.message);
        
        if (providerName !== session.fallbackProviders[session.fallbackProviders.length - 1]) {
          // Wait before trying next provider
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError.message}`);
  }

  /**
   * Generate cache key for translation
   */
  generateCacheKey(text, sourceLanguage, targetLanguage) {
    return `${sourceLanguage}-${targetLanguage}:${text.toLowerCase().trim()}`;
  }

  /**
   * Clean up cache to prevent memory issues
   */
  cleanupCache() {
    if (this.cache.size <= this.config.cacheSize) {
      return;
    }

    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, Math.floor(this.config.cacheSize * 0.2)); // Remove 20%
    
    toRemove.forEach(([key]) => {
      this.cache.delete(key);
    });

    this.log(`Cache cleanup: removed ${toRemove.length} entries`);
  }

  /**
   * Update provider usage statistics
   */
  updateProviderStats(providerName) {
    if (!this.stats.providerUsage[providerName]) {
      this.stats.providerUsage[providerName] = 0;
    }
    this.stats.providerUsage[providerName]++;
  }

  /**
   * Update average processing time
   */
  updateAverageProcessingTime(processingTime) {
    const total = this.stats.averageProcessingTime * (this.stats.totalTranslations - 1) + processingTime;
    this.stats.averageProcessingTime = total / this.stats.totalTranslations;
  }

  /**
   * Calculate session statistics
   */
  calculateSessionStats(session) {
    return {
      sessionId: session.sessionId,
      duration: Date.now() - session.startTime,
      translationsReceived: session.translationsReceived,
      translationsProcessed: session.translationsProcessed,
      errorsCount: session.errorsCount,
      successRate: session.translationsProcessed > 0 
        ? ((session.translationsProcessed - session.errorsCount) / session.translationsProcessed * 100).toFixed(1) + '%'
        : '0%',
      languageChanges: session.lastLanguageChange > session.startTime ? 1 : 0
    };
  }

  /**
   * Clean up session resources
   */
  cleanupSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Debug logging
   */
  log(message, data = null) {
    if (this.config.enableDebugLogging) {
      console.log(`[TranslationAgent] ${message}`, data ? data : '');
    }
  }
}

export default TranslationAgent;
