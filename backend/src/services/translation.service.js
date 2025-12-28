/**
 * Mock Translation Service
 * In production, this would integrate with Google Translate API or similar
 */

class TranslationService {
  /**
   * Mock text translation
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code (optional)
   * @returns {Promise<Object>} Translation result
   */
  static async translateText(text, targetLanguage, sourceLanguage = 'auto') {
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    // Mock translations
    const translations = {
      'en-hi': {
        'Hello everyone, welcome to today\'s conference': 'ार सभीनमस्क, आज के सम्मेलन में आपका स्वागत है',
        'Today we\'ll be discussing machine learning': 'आज हम मशीन लर्निंग पर चर्चा करेंगे',
        'Thank you for your attention': 'आपकी ध्यान के लिए धन्यवाद',
        'Are there any questions?': 'क्या कोई प्रश्न हैं?',
        'The model shows excellent performance': 'यह मॉडल उत्कृष्ट प्रदर्शन दिखाता है',
        'We need to improve the algorithm': 'हमें एल्गोरिथ्म में सुधार करना है'
      },
      'en-es': {
        'Hello everyone, welcome to today\'s conference': 'Hola a todos, bienvenidos a la conferencia de hoy',
        'Today we\'ll be discussing machine learning': 'Hoy discutiremos el aprendizaje automático',
        'Thank you for your attention': 'Gracias por su atención',
        'Are there any questions?': '¿Hay alguna pregunta?',
        'The model shows excellent performance': 'El modelo muestra un excelente rendimiento',
        'We need to improve the algorithm': 'Necesitamos mejorar el algoritmo'
      },
      'en-fr': {
        'Hello everyone, welcome to today\'s conference': 'Bonjour à tous, bienvenue à la conférence d\'aujourd\'hui',
        'Today we\'ll be discussing machine learning': 'Aujourd\'hui, nous discuterons de l\'apprentissage automatique',
        'Thank you for your attention': 'Merci pour votre attention',
        'Are there any questions?': 'Y a-t-il des questions?',
        'The model shows excellent performance': 'Le modèle montre d\'excellentes performances',
        'We need to improve the algorithm': 'Nous devons améliorer l\'algorithme'
      },
      'hi-en': {
        'नमस्कार सभी, आज के सम्मेलन में आपका स्वागत है': 'Hello everyone, welcome to today\'s conference',
        'आज हम मशीन लर्निंग पर चर्चा करेंगे': 'Today we\'ll be discussing machine learning',
        'धन्यवाद': 'Thank you',
        'क्या कोई प्रश्न हैं?': 'Are there any questions?'
      }
    };

    const translationKey = `${sourceLanguage}-${targetLanguage}`;
    let translatedText = text;

    // Check if we have a predefined translation
    if (translations[translationKey] && translations[translationKey][text]) {
      translatedText = translations[translationKey][text];
    } else {
      // Mock translation for unknown phrases
      const mockTranslations = {
        'en-hi': `[Hindi Translation] ${text}`,
        'en-es': `[Spanish Translation] ${text}`,
        'en-fr': `[French Translation] ${text}`,
        'hi-en': `[English Translation] ${text}`,
        'es-en': `[English Translation] ${text}`,
        'fr-en': `[English Translation] ${text}`
      };

      if (mockTranslations[translationKey]) {
        translatedText = mockTranslations[translationKey];
      }
    }

    return {
      originalText: text,
      translatedText,
      sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
      targetLanguage,
      confidence: 0.80 + Math.random() * 0.19, // 80-99% confidence
      timestamp: new Date()
    };
  }

  /**
   * Mock batch translation
   * @param {Array} texts - Array of texts to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code
   * @returns {Promise<Array>} Array of translation results
   */
  static async translateBatch(texts, targetLanguage, sourceLanguage = 'auto') {
    const results = await Promise.all(
      texts.map(text => this.translateText(text, targetLanguage, sourceLanguage))
    );

    return results;
  }

  /**
   * Mock language detection
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Detected language with confidence
   */
  static async detectLanguage(text) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));

    // Simple mock language detection based on character patterns
    let detectedLanguage = 'en';
    let confidence = 0.7;

    // Check for Hindi characters
    if (/[\u0900-\u097F]/.test(text)) {
      detectedLanguage = 'hi';
      confidence = 0.95;
    }
    // Check for Spanish patterns
    else if (/\b(hola|gracias|por favor|conferencia)\b/i.test(text)) {
      detectedLanguage = 'es';
      confidence = 0.85;
    }
    // Check for French patterns
    else if (/\b(bonjour|merci|conférence|aujourd'hui)\b/i.test(text)) {
      detectedLanguage = 'fr';
      confidence = 0.85;
    }

    return {
      language: detectedLanguage,
      confidence,
      timestamp: new Date()
    };
  }

  /**
   * Get supported languages
   * @returns {Array} List of supported language codes and names
   */
  static getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
      { code: 'fr', name: 'French', flag: '🇫🇷' }
    ];
  }

  /**
   * Mock translation for real-time captions
   * @param {string} text - Caption text
   * @param {string} targetLanguage - Target language
   * @returns {Promise<Object>} Real-time translation
   */
  static async translateCaption(text, targetLanguage) {
    // Shorter delay for real-time captions
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    const result = await this.translateText(text, targetLanguage);
    
    return {
      ...result,
      isRealTime: true,
      processingTime: Date.now() - result.timestamp.getTime()
    };
  }
}

export default TranslationService;

