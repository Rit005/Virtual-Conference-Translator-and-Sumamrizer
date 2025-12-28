/**
 * TranslationAgent Example Usage
 * 
 * Demonstrates how to use the TranslationAgent for real-time transcription translation.
 * Shows integration with TranscriptionAgentRefined and WebSocket events.
 */

import TranslationAgent from '../agents/translationAgent.js';
import TranscriptionAgentRefined from '../agents/transcriptionAgentRefined.js';
import WhisperService from '../services/whisper.service.js';

class TranslationAgentExample {
  constructor() {
    this.translationAgent = new TranslationAgent({
      defaultProvider: 'mock', // Change to 'openai' or 'claude' for production
      enableDebugLogging: true,
      enableCaching: true,
      realTimeThreshold: 500
    });

    this.transcriptionAgent = null;
    this.sessions = new Map();
  }

  /**
   * Initialize both agents and set up integration
   */
  async initialize() {
    console.log('🚀 Initializing TranslationAgent Example...');

    try {
      // Initialize translation agent
      const translationInitialized = await this.translationAgent.initialize();
      if (!translationInitialized) {
        throw new Error('Failed to initialize TranslationAgent');
      }

      // Initialize transcription agent with ASR service
      this.transcriptionAgent = new TranscriptionAgentRefined({
        asrService: new WhisperService(),
        enableDebugLogging: true
      });

      const transcriptionInitialized = await this.transcriptionAgent.initialize();
      if (!transcriptionInitialized) {
        throw new Error('Failed to initialize TranscriptionAgent');
      }

      // Set up event integration
      this.setupEventIntegration();

      console.log('✅ Both agents initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Set up event integration between transcription and translation agents
   */
  setupEventIntegration() {
    // Listen to transcription events and translate them
    this.transcriptionAgent.on('transcription:partial', async (transcriptionData) => {
      console.log(`📝 Received transcription: "${transcriptionData.text.substring(0, 50)}..."`);
      
      try {
        // Process transcription for translation
        await this.translationAgent.processTranscription(
          transcriptionData.sessionId,
          transcriptionData
        );
      } catch (error) {
        console.error(`❌ Translation failed for session ${transcriptionData.sessionId}:`, error.message);
      }
    });

    // Listen to translation events
    this.translationAgent.on('translation:partial', (translationData) => {
      console.log(`🌍 Translation: "${translationData.originalText.substring(0, 30)}..." → "${translationData.translatedText.substring(0, 30)}..."`);
      console.log(`   Language: ${translationData.sourceLanguage} → ${translationData.targetLanguage}`);
      console.log(`   Confidence: ${(translationData.confidence * 100).toFixed(1)}%`);
      console.log(`   Provider: ${translationData.provider}`);
      console.log(`   Processing time: ${translationData.processingTime}ms`);
      
      // In a real application, you would emit this to WebSocket clients
      this.emitToClients('translation:partial', translationData);
    });

    // Listen to translation errors
    this.translationAgent.on('translation:error', (errorData) => {
      console.error(`❌ Translation error for session ${errorData.sessionId}:`, errorData.error);
      
      // In a real application, you would emit this to WebSocket clients
      this.emitToClients('translation:error', errorData);
    });

    // Listen to session events
    this.translationAgent.on('translation:session:started', (sessionData) => {
      console.log(`🎬 Translation session started: ${sessionData.sessionId} (${sessionData.targetLanguage})`);
    });

    this.translationAgent.on('translation:session:stopped', (sessionData) => {
      console.log(`🏁 Translation session stopped: ${sessionData.sessionId}`);
      console.log(`   Stats:`, sessionData.stats);
    });

    this.translationAgent.on('translation:language:changed', (changeData) => {
      console.log(`🔄 Language changed for session ${changeData.sessionId}: ${changeData.oldLanguage} → ${changeData.newLanguage}`);
    });

    console.log('🔗 Event integration set up successfully');
  }

  /**
   * Start a complete translation session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Session options
   */
  async startTranslationSession(sessionId, options = {}) {
    console.log(`\n🎯 Starting translation session: ${sessionId}`);

    try {
      // Start transcription session
      await this.transcriptionAgent.startSession(sessionId, {
        language: options.sourceLanguage || 'en',
        autoDetectLanguage: true
      });

      // Start translation session
      await this.translationAgent.startSession(sessionId, {
        targetLanguage: options.targetLanguage || 'es',
        sourceLanguage: options.sourceLanguage || 'en',
        provider: options.provider || 'mock'
      });

      this.sessions.set(sessionId, {
        startTime: Date.now(),
        options,
        isActive: true
      });

      console.log(`✅ Translation session started successfully`);
      console.log(`   Source: ${options.sourceLanguage || 'en'} → Target: ${options.targetLanguage || 'es'}`);
      console.log(`   Provider: ${options.provider || 'mock'}`);

      return {
        success: true,
        sessionId,
        ...options
      };

    } catch (error) {
      console.error(`❌ Failed to start session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Process audio chunk through the complete pipeline
   * @param {string} sessionId - Session identifier
   * @param {Buffer} audioData - Audio data chunk
   * @param {Object} metadata - Audio metadata
   */
  async processAudioChunk(sessionId, audioData, metadata = {}) {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Process audio through transcription agent
      await this.transcriptionAgent.processChunk(sessionId, audioData, metadata);
      
      console.log(`🎵 Audio chunk processed for session ${sessionId}`);

    } catch (error) {
      console.error(`❌ Audio chunk processing failed for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Switch target language during active session
   * @param {string} sessionId - Session identifier
   * @param {string} newLanguage - New target language code
   */
  async switchLanguage(sessionId, newLanguage) {
    console.log(`🔄 Switching language for session ${sessionId} to ${newLanguage}`);

    try {
      const result = await this.translationAgent.switchLanguage(sessionId, newLanguage);
      console.log(`✅ Language switched successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Language switch failed for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Session identifier
   */
  getSessionStatus(sessionId) {
    const translationStatus = this.translationAgent.getSessionStatus(sessionId);
    const transcriptionStatus = this.transcriptionAgent.getSessionStatus(sessionId);
    
    return {
      sessionId,
      translation: translationStatus,
      transcription: transcriptionStatus,
      combinedStatus: {
        active: translationStatus.active && transcriptionStatus.active,
        duration: Math.min(
          translationStatus.duration || 0,
          transcriptionStatus.duration || 0
        )
      }
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const translationSessions = this.translationAgent.getActiveSessions();
    const transcriptionSessions = this.transcriptionAgent.getActiveSessions();
    
    return {
      translation: translationSessions,
      transcription: transcriptionSessions,
      total: translationSessions.length + transcriptionSessions.length
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      translation: this.translationAgent.getStats(),
      transcription: this.transcriptionAgent.getStats(),
      sessions: {
        total: this.sessions.size,
        active: Array.from(this.sessions.values()).filter(s => s.isActive).length
      }
    };
  }

  /**
   * Stop a translation session
   * @param {string} sessionId - Session identifier
   */
  async stopSession(sessionId) {
    console.log(`\n🛑 Stopping translation session: ${sessionId}`);

    try {
      // Stop both agents for this session
      await Promise.all([
        this.transcriptionAgent.stopSession(sessionId),
        this.translationAgent.stopSession(sessionId)
      ]);

      // Update session status
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isActive = false;
        session.endTime = Date.now();
      }

      console.log(`✅ Session ${sessionId} stopped successfully`);

      return {
        success: true,
        sessionId,
        duration: session ? (session.endTime - session.startTime) : 0
      };

    } catch (error) {
      console.error(`❌ Failed to stop session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Stop all active sessions
   */
  async stopAllSessions() {
    console.log('\n🛑 Stopping all translation sessions...');

    const sessionIds = Array.from(this.sessions.keys());
    const results = await Promise.allSettled(
      sessionIds.map(sessionId => this.stopSession(sessionId))
    );

    console.log(`✅ Stopped ${results.filter(r => r.status === 'fulfilled').length} sessions`);
    
    return results;
  }

  /**
   * Simulate translation workflow (for demo purposes)
   */
  async simulateTranslationWorkflow() {
    console.log('\n🎭 Starting translation workflow simulation...');

    const sessionId = `demo_${Date.now()}`;
    
    try {
      // Start session
      await this.startTranslationSession(sessionId, {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        provider: 'mock'
      });

      // Simulate transcription events (normally would come from audio processing)
      const mockTranscriptions = [
        { text: 'Hello everyone, welcome to today\'s conference', language: 'en' },
        { text: 'Today we\'ll be discussing machine learning and AI', language: 'en' },
        { text: 'Thank you for your attention', language: 'en' },
        { text: 'Are there any questions?', language: 'en' }
      ];

      // Process mock transcriptions
      for (const transcription of mockTranscriptions) {
        const transcriptionData = {
          sessionId,
          text: transcription.text,
          language: transcription.language,
          confidence: 0.9,
          isFinal: true,
          chunkCount: 1,
          processingTime: 200
        };

        // Simulate transcription event
        this.transcriptionAgent.emit('transcription:partial', transcriptionData);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Switch language mid-session
      await this.switchLanguage(sessionId, 'fr');
      
      // Continue with more mock transcriptions
      const moreTranscriptions = [
        { text: 'This is very important for our project', language: 'en' },
        { text: 'Let me explain the next steps', language: 'en' }
      ];

      for (const transcription of moreTranscriptions) {
        const transcriptionData = {
          sessionId,
          text: transcription.text,
          language: transcription.language,
          confidence: 0.85,
          isFinal: true,
          chunkCount: 1,
          processingTime: 180
        };

        this.transcriptionAgent.emit('transcription:partial', transcriptionData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get final statistics
      console.log('\n📊 Final Statistics:');
      console.log(JSON.stringify(this.getStats(), null, 2));

      // Stop session
      await this.stopSession(sessionId);

    } catch (error) {
      console.error('❌ Simulation failed:', error.message);
    }
  }

  /**
   * Shutdown the example system
   */
  async shutdown() {
    console.log('\n🔄 Shutting down TranslationAgent Example...');

    try {
      // Stop all sessions
      await this.stopAllSessions();

      // Shutdown agents
      await Promise.all([
        this.translationAgent.shutdown(),
        this.transcriptionAgent.shutdown()
      ]);

      console.log('✅ TranslationAgent Example shutdown complete');

    } catch (error) {
      console.error('❌ Shutdown error:', error.message);
    }
  }

  /**
   * Emit events to connected clients (simulated)
   */
  emitToClients(eventType, data) {
    // In a real application, this would emit to WebSocket clients
    console.log(`📡 Emitting to clients: ${eventType}`);
    
    // Simulate client emission
    setTimeout(() => {
      console.log(`📱 Client received: ${eventType}`, {
        sessionId: data.sessionId,
        text: data.originalText ? 
          `${data.originalText.substring(0, 30)}... → ${data.translatedText?.substring(0, 30)}...` : 
          data.error
      });
    }, 50);
  }

  /**
   * Demo supported languages
   */
  showSupportedLanguages() {
    console.log('\n🌍 Supported Languages:');
    const languages = this.translationAgent.getSupportedLanguages();
    
    languages.forEach(lang => {
      console.log(`   ${lang.flag} ${lang.name} (${lang.code}) - ${lang.nativeName}`);
    });
  }

  /**
   * Demo provider switching
   */
  async demoProviderSwitching() {
    console.log('\n🔄 Provider Switching Demo...');

    const sessionId = 'provider_demo';
    
    try {
      // Start session with mock provider
      await this.startTranslationSession(sessionId, {
        targetLanguage: 'es',
        provider: 'mock'
      });

      // Simulate translation
      const testText = 'Hello everyone, welcome to today\'s conference';
      const transcriptionData = {
        sessionId,
        text: testText,
        language: 'en',
        confidence: 0.9,
        isFinal: true
      };

      this.transcriptionAgent.emit('transcription:partial', transcriptionData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get stats to show provider usage
      const stats = this.getStats();
      console.log('📊 Provider Usage:', stats.translation.providerUsage);

      await this.stopSession(sessionId);

    } catch (error) {
      console.error('❌ Provider switching demo failed:', error.message);
    }
  }
}

// Example usage
async function runExample() {
  const example = new TranslationAgentExample();
  
  try {
    // Initialize the system
    await example.initialize();
    
    // Show supported languages
    example.showSupportedLanguages();
    
    // Run simulation
    await example.simulateTranslationWorkflow();
    
    // Demo provider switching
    await example.demoProviderSwitching();
    
    // Get final stats
    console.log('\n📈 Final System Statistics:');
    console.log(JSON.stringify(example.getStats(), null, 2));
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
  } finally {
    // Cleanup
    await example.shutdown();
  }
}

// Export for use in other modules
export default TranslationAgentExample;
export { runExample };

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample().catch(console.error);
}
