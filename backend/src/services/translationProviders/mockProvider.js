/**
 * Mock Translation Provider
 * 
 * Development and testing provider with realistic translation behavior.
 * Simulates API responses with realistic processing times and confidence scores.
 * Perfect for development, testing, and offline scenarios.
 */

import TranslationProvider from './baseProvider.js';

class MockProvider extends TranslationProvider {
  constructor(options = {}) {
    super(options);
    
    this.name = 'Mock';
    this.config = {
      enableRealisticTiming: options.enableRealisticTiming !== false,
      baseDelay: options.baseDelay || 200, // Base processing delay in ms
      maxDelay: options.maxDelay || 800, // Maximum processing delay in ms
      errorRate: options.errorRate || 0.02, // 2% error rate for testing
      cacheEnabled: options.cacheEnabled !== false
    };

    // Comprehensive translation dictionary for realistic simulation
    this.translationDictionary = {
      'en-hi': {
        'Hello everyone, welcome to today\'s conference': 'सभी को नमस्कार, आज के सम्मेलन में आपका स्वागत है',
        'Today we\'ll be discussing': 'आज हम चर्चा करेंगे',
        'machine learning and AI': 'मशीन लर्निंग और AI',
        'Thank you for your attention': 'आपकी ध्यान के लिए धन्यवाद',
        'Are there any questions?': 'क्या कोई प्रश्न हैं?',
        'The model shows excellent performance': 'यह मॉडल उत्कृष्ट प्रदर्शन दिखाता है',
        'We need to improve the algorithm': 'हमें एल्गोरिथ्म में सुधार करना है',
        'This is very important': 'यह बहुत महत्वपूर्ण है',
        'Let me explain': 'मुझे समझाइए',
        'Moving forward': 'आगे बढ़ते हुए',
        'What do you think?': 'आप क्या सोचते हैं?',
        'Let\'s continue with the presentation': 'प्रस्तुति के साथ आगे बढ़ते हैं',
        'Can you hear me clearly?': 'क्या आप स्पष्ट रूप से सुन सकते हैं?',
        'The results are impressive': 'परिणाम प्रभावशाली हैं',
        'We should consider all options': 'हमें सभी विकल्पों पर विचार करना चाहिए'
      },
      'en-es': {
        'Hello everyone, welcome to today\'s conference': 'Hola a todos, bienvenidos a la conferencia de hoy',
        'Today we\'ll be discussing': 'Hoy discutiremos',
        'machine learning and AI': 'aprendizaje automático e IA',
        'Thank you for your attention': 'Gracias por su atención',
        'Are there any questions?': '¿Hay alguna pregunta?',
        'The model shows excellent performance': 'El modelo muestra un excelente rendimiento',
        'We need to improve the algorithm': 'Necesitamos mejorar el algoritmo',
        'This is very important': 'Esto es muy importante',
        'Let me explain': 'Déjenme explicar',
        'Moving forward': 'De ahora en adelante',
        'What do you think?': '¿Qué piensan?',
        'Let\'s continue with the presentation': 'Continuemos con la presentación',
        'Can you hear me clearly?': '¿Pueden escucharme claramente?',
        'The results are impressive': 'Los resultados son impresionantes',
        'We should consider all options': 'Deberíamos considerar todas las opciones'
      },
      'en-fr': {
        'Hello everyone, welcome to today\'s conference': 'Bonjour à tous, bienvenue à la conférence d\'aujourd\'hui',
        'Today we\'ll be discussing': 'Aujourd\'hui, nous discuterons',
        'machine learning and AI': 'apprentissage automatique et IA',
        'Thank you for your attention': 'Merci pour votre attention',
        'Are there any questions?': 'Y a-t-il des questions?',
        'The model shows excellent performance': 'Le modèle montre d\'excellentes performances',
        'We need to improve the algorithm': 'Nous devons améliorer l\'algorithme',
        'This is very important': 'Ceci est très important',
        'Let me explain': 'Laissez-moi expliquer',
        'Moving forward': 'À l\'avenir',
        'What do you think?': 'Qu\'en pensez-vous?',
        'Let\'s continue with the presentation': 'Continuons avec la présentation',
        'Can you hear me clearly?': 'Pouvez-vous m\'entendre clairement?',
        'The results are impressive': 'Les résultats sont impressionnants',
        'We should consider all options': 'Nous devrions considérer toutes les options'
      },
      'hi-en': {
        'सभी को नमस्कार, आज के सम्मेलन में आपका स्वागत है': 'Hello everyone, welcome to today\'s conference',
        'आज हम चर्चा करेंगे': 'Today we\'ll be discussing',
        'मशीन लर्निंग और AI': 'machine learning and AI',
        'आपकी ध्यान के लिए धन्यवाद': 'Thank you for your attention',
        'क्या कोई प्रश्न हैं?': 'Are there any questions?',
        'यह मॉडल उत्कृष्ट प्रदर्शन दिखाता है': 'The model shows excellent performance',
        'हमें एल्गोरिथ्म में सुधार करना है': 'We need to improve the algorithm'
      },
      'es-en': {
        'Hola a todos, bienvenidos a la conferencia de hoy': 'Hello everyone, welcome to today\'s conference',
        'Hoy discutiremos': 'Today we\'ll be discussing',
        'aprendizaje automático e IA': 'machine learning and AI',
        'Gracias por su atención': 'Thank you for your attention',
        '¿Hay alguna pregunta?': 'Are there any questions?'
      },
      'fr-en': {
        'Bonjour à tous, bienvenue à la conférence d\'aujourd\'hui': 'Hello everyone, welcome to today\'s conference',
        'Aujourd\'hui, nous discuterons': 'Today we\'ll be discussing',
        'apprentissage automatique et IA': 'machine learning and AI',
        'Merci pour votre attention': 'Thank you for your attention',
        'Y a-t-il des questions?': 'Are there any questions?'
      }
    };

    // Mock language detection patterns
    this.languagePatterns = {
      'hi': /[\u0900-\u097F]/, // Hindi Devanagari
      'es': /\b(hola|gracias|por favor|conferencia|que|es|para|está|ser|tener|hacer|ir)\b/i,
      'fr': /\b(bonjour|merci|pour|conférence|aujourd'hui|le|la|les|est|être|avoir|faire|aller)\b/i,
      'de': /\b(hallo|danke|für|konferenz|heute|der|die|das|ist|sein|haben|machen|gehen)\b/i,
      'it': /\b(ciao|grazie|per|conferenza|oggi|il|la|lo|è|essere|avere|fare|andare)\b/i
    };

    // Supported languages with metadata
    this.supportedLanguages = {
      'en': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
      'hi': { name: 'Hindi', flag: '🇮🇳', nativeName: 'हिंदी' },
      'es': { name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
      'fr': { name: 'French', flag: '🇫🇷', nativeName: 'Français' },
      'de': { name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
      'it': { name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
      'pt': { name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
      'ru': { name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
      'ja': { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
      'ko': { name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
      'zh': { name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
      'ar': { name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
      'nl': { name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
      'sv': { name: 'Swedish', flag: '🇸🇪', nativeName: 'Svenska' },
      'da': { name: 'Danish', flag: '🇩🇰', nativeName: 'Dansk' },
      'no': { name: 'Norwegian', flag: '🇳🇴', nativeName: 'Norsk' },
      'fi': { name: 'Finnish', flag: '🇫🇮', nativeName: 'Suomi' },
      'pl': { name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
      'tr': { name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' }
    };

    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageResponseTime: 0
    };

    // Internal cache for realistic simulation
    this.cache = new Map();
  }

  /**
   * Initialize the Mock provider
   */
  async initialize() {
    // Mock initialization - always successful
    await this.simulateDelay(50);
    
    this.isInitialized = true;
    this.log('Mock provider initialized successfully');
    return true;
  }

  /**
   * Translate text using mock implementation
   */
  async translate(text, options = {}) {
    const startTime = Date.now();
    
    try {
      this.validateText(text);

      // Simulate potential error
      if (Math.random() < this.config.errorRate) {
        throw new Error('Mock translation error for testing');
      }

      const sourceLanguage = options.sourceLanguage || 'auto';
      const targetLanguage = options.targetLanguage || 'en';

      // Skip if source and target are the same
      if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
        return {
          originalText: text,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          confidence: 1.0,
          isIdentical: true,
          processingTime: Date.now() - startTime
        };
      }

      // Check cache first
      const cacheKey = `${sourceLanguage}-${targetLanguage}:${text.toLowerCase()}`;
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        this.log(`Cache hit for translation: "${text.substring(0, 30)}..."`);
        
        // Add realistic processing delay even for cache hits
        if (this.config.enableRealisticTiming) {
          await this.simulateDelay(this.config.baseDelay * 0.3);
        }
        
        return {
          ...this.cache.get(cacheKey),
          processingTime: Date.now() - startTime
        };
      }

      this.stats.cacheMisses++;

      // Auto-detect language if needed
      if (sourceLanguage === 'auto') {
        const detectedLanguage = await this.detectLanguage(text);
        sourceLanguage = detectedLanguage;
      }

      // Generate or retrieve translation
      let translatedText = await this.generateTranslation(text, sourceLanguage, targetLanguage);

      // Calculate confidence based on various factors
      const confidence = this.calculateConfidence(text, translatedText, sourceLanguage, targetLanguage);

      // Simulate realistic processing time
      if (this.config.enableRealisticTiming) {
        const processingTime = this.config.baseDelay + Math.random() * (this.config.maxDelay - this.config.baseDelay);
        await this.simulateDelay(processingTime);
      }

      const result = {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence,
        processingTime: Date.now() - startTime
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, result);
      }

      // Update statistics
      this.updateStats(Date.now() - startTime);

      this.log(`Mock translation: "${text.substring(0, 30)}..." → "${translatedText.substring(0, 30)}..."`);

      return result;

    } catch (error) {
      this.stats.errors++;
      this.log(`Mock translation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Batch translate multiple texts
   */
  async translateBatch(texts, targetLanguage, sourceLanguage = 'auto') {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    // Process batch with realistic delays
    const results = [];
    for (const text of texts) {
      const result = await this.translate(text, { targetLanguage, sourceLanguage });
      results.push(result);
      
      // Small delay between batch items for realism
      if (this.config.enableRealisticTiming && texts.indexOf(text) < texts.length - 1) {
        await this.simulateDelay(50);
      }
    }

    return results;
  }

  /**
   * Detect language using mock implementation
   */
  async detectLanguage(text) {
    // Simulate processing time
    await this.simulateDelay(100 + Math.random() * 200);

    // Check patterns for each supported language
    for (const [languageCode, pattern] of Object.entries(this.languagePatterns)) {
      if (pattern.test(text)) {
        return languageCode;
      }
    }

    // Default to English for unknown patterns
    return 'en';
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return Object.entries(this.supportedLanguages).map(([code, info]) => ({
      code,
      ...info
    }));
  }

  /**
   * Get provider health status (always healthy for mock)
   */
  async getHealthStatus() {
    return {
      healthy: true,
      status: 'ok',
      responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
      lastChecked: new Date(),
      mockProvider: true
    };
  }

  /**
   * Get cost estimate (always free for mock)
   */
  getCostEstimate(characters) {
    return {
      characters,
      estimatedCost: 0,
      currency: 'USD',
      provider: this.name,
      note: 'Mock provider - no actual cost'
    };
  }

  /**
   * Clear internal cache
   */
  clearCache() {
    this.cache.clear();
    this.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0 
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 
      : 0;

    return {
      size: this.cache.size,
      hitRate: `${hitRate.toFixed(1)}%`,
      hits: this.stats.cacheHits,
      misses: this.stats.cacheMisses
    };
  }

  /**
   * Get provider statistics
   */
  getStats() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0 
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 
      : 0;

    return {
      ...super.getStats(),
      totalRequests: this.stats.totalRequests,
      cacheHitRate: `${hitRate.toFixed(1)}%`,
      errors: this.stats.errors,
      averageResponseTime: `${this.stats.averageResponseTime.toFixed(0)}ms`,
      errorRate: `${((this.stats.errors / this.stats.totalRequests) * 100).toFixed(2)}%`
    };
  }

  /**
   * Cleanup provider resources
   */
  async cleanup() {
    this.cache.clear();
    await super.cleanup();
    this.log('Mock provider cleaned up');
  }

  // Private helper methods

  /**
   * Generate translation using dictionary or mock
   */
  async generateTranslation(text, sourceLanguage, targetLanguage) {
    // Check for predefined translation
    const translationKey = `${sourceLanguage}-${targetLanguage}`;
    if (this.translationDictionary[translationKey] && 
        this.translationDictionary[translationKey][text]) {
      return this.translationDictionary[translationKey][text];
    }

    // Generate mock translation for unknown phrases
    return this.generateMockTranslation(text, sourceLanguage, targetLanguage);
  }

  /**
   * Generate mock translation for unknown phrases
   */
  generateMockTranslation(text, sourceLanguage, targetLanguage) {
    const mockPrefixes = {
      'en-hi': '[Hindi Translation]',
      'en-es': '[Spanish Translation]', 
      'en-fr': '[French Translation]',
      'en-de': '[German Translation]',
      'en-it': '[Italian Translation]',
      'hi-en': '[English Translation]',
      'es-en': '[English Translation]',
      'fr-en': '[English Translation]',
      'de-en': '[English Translation]',
      'it-en': '[English Translation]'
    };

    const key = `${sourceLanguage}-${targetLanguage}`;
    const prefix = mockPrefixes[key] || `[${targetLanguage.toUpperCase()} Translation]`;
    
    return `${prefix} ${text}`;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(originalText, translatedText, sourceLanguage, targetLanguage) {
    let confidence = 0.75; // Base confidence for mock provider

    // Higher confidence for predefined translations
    const translationKey = `${sourceLanguage}-${targetLanguage}`;
    if (this.translationDictionary[translationKey] && 
        this.translationDictionary[translationKey][originalText]) {
      confidence += 0.15; // Boost confidence for predefined translations
    }

    // Adjust based on text length
    if (originalText.length < 10) confidence -= 0.05;
    if (originalText.length > 200) confidence -= 0.05;

    // Adjust based on language pair quality
    if (['en-hi', 'en-es', 'en-fr'].includes(translationKey)) {
      confidence += 0.05; // Better support for these pairs
    }

    // Add some randomness to make it realistic
    confidence += (Math.random() - 0.5) * 0.1;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  /**
   * Simulate realistic processing delay
   */
  async simulateDelay(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Update provider statistics
   */
  updateStats(responseTime) {
    this.stats.totalRequests++;
    
    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;
  }
}

export default MockProvider;
