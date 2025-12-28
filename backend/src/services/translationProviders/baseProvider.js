/**
 * Translation Provider Interface
 * 
 * Base interface that all translation providers must implement.
 * This ensures consistency across different translation services.
 */

class TranslationProvider {
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.name = 'TranslationProvider';
  }

  /**
   * Initialize the translation provider
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    throw new Error('initialize() must be implemented by provider');
  }

  /**
   * Translate text from source language to target language
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @returns {Promise<Object>} Translation result
   */
  async translate(text, options = {}) {
    throw new Error('translate() must be implemented by provider');
  }

  /**
   * Get list of supported languages
   * @returns {Array} Array of supported language objects
   */
  getSupportedLanguages() {
    throw new Error('getSupportedLanguages() must be implemented by provider');
  }

  /**
   * Detect language of given text
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Detected language with confidence
   */
  async detectLanguage(text) {
    throw new Error('detectLanguage() must be implemented by provider');
  }

  /**
   * Batch translate multiple texts
   * @param {Array} texts - Array of texts to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code
   * @returns {Promise<Array>} Array of translation results
   */
  async translateBatch(texts, targetLanguage, sourceLanguage = 'auto') {
    throw new Error('translateBatch() must be implemented by provider');
  }

  /**
   * Get provider-specific configuration options
   * @returns {Object} Configuration schema
   */
  getConfigSchema() {
    throw new Error('getConfigSchema() must be implemented by provider');
  }

  /**
   * Validate provider configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateConfig(config) {
    throw new Error('validateConfig() must be implemented by provider');
  }

  /**
   * Get provider health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    throw new Error('getHealthStatus() must be implemented by provider');
  }

  /**
   * Get provider statistics
   * @returns {Object} Provider statistics
   */
  getStats() {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      supportedLanguages: this.getSupportedLanguages().length
    };
  }

  /**
   * Cleanup provider resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.isInitialized = false;
  }

  /**
   * Check if provider is healthy and ready for use
   * @returns {boolean} Provider health status
   */
  isHealthy() {
    return this.isInitialized;
  }

  /**
   * Get estimated cost for translation
   * @param {number} characters - Number of characters to translate
   * @returns {Object} Cost estimate
   */
  getCostEstimate(characters) {
    return {
      characters,
      estimatedCost: 0,
      currency: 'USD',
      provider: this.name
    };
  }

  /**
   * Validate text for translation
   * @param {string} text - Text to validate
   * @returns {Object} Validation result
   */
  validateText(text) {
    const errors = [];
    const warnings = [];

    if (!text || text.trim().length === 0) {
      errors.push('Text cannot be empty');
    }

    if (text.length > 10000) {
      errors.push('Text length exceeds maximum limit of 10,000 characters');
      warnings.push('Consider splitting into smaller chunks');
    }

    if (text.length < 2) {
      warnings.push('Very short text may not translate accurately');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      characterCount: text.length
    };
  }

  /**
   * Log provider-specific messages
   */
  log(message, level = 'info') {
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'debug':
        console.debug(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }
}

export default TranslationProvider;
