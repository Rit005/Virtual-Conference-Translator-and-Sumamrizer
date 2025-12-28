/**
 * Abstract ASR (Automatic Speech Recognition) Service Interface
 * 
 * This provides a standardized interface for different speech-to-text services
 * to enable easy swapping between providers like OpenAI Whisper, Google Cloud Speech-to-Text,
 * Azure Speech Services, etc.
 */

class ASRService {
  constructor(config = {}) {
    this.config = config;
    this.isInitialized = false;
  }

  /**
   * Initialize the ASR service
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer|string} audioBuffer - Audio data to transcribe
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioBuffer, options = {}) {
    throw new Error('transcribe() must be implemented by subclass');
  }

  /**
   * Get partial/real-time transcription
   * @param {Buffer|string} audioBuffer - Audio data for partial transcription
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Partial transcription result
   */
  async transcribePartial(audioBuffer, options = {}) {
    throw new Error('transcribePartial() must be implemented by subclass');
  }

  /**
   * Detect language of audio content
   * @param {Buffer|string} audioBuffer - Audio data
   * @returns {Promise<Object>} Language detection result
   */
  async detectLanguage(audioBuffer) {
    throw new Error('detectLanguage() must be implemented by subclass');
  }

  /**
   * Validate audio data format
   * @param {Buffer|string} audioBuffer - Audio data to validate
   * @returns {Object} Validation result
   */
  validateAudioFormat(audioBuffer) {
    const errors = [];

    if (!audioBuffer) {
      errors.push('Audio buffer is required');
    }

    if (typeof audioBuffer === 'string' && audioBuffer.length === 0) {
      errors.push('Audio buffer cannot be empty');
    }

    if (Buffer.isBuffer(audioBuffer) && audioBuffer.length === 0) {
      errors.push('Audio buffer cannot be empty');
    }

    // Additional format validation can be added by subclasses
    if (this.config.maxAudioSize && this.getAudioSize(audioBuffer) > this.config.maxAudioSize) {
      errors.push(`Audio buffer exceeds maximum size of ${this.config.maxAudioSize} bytes`);
    }

    return {
      valid: errors.length === 0,
      errors,
      size: this.getAudioSize(audioBuffer)
    };
  }

  /**
   * Get audio buffer size
   * @param {Buffer|string} audioBuffer - Audio data
   * @returns {number} Size in bytes
   */
  getAudioSize(audioBuffer) {
    if (Buffer.isBuffer(audioBuffer)) {
      return audioBuffer.length;
    }
    if (typeof audioBuffer === 'string') {
      // Assume base64 encoded audio
      return Buffer.byteLength(audioBuffer, 'base64');
    }
    return 0;
  }

  /**
   * Get supported languages for this ASR service
   * @returns {Array<string>} Array of supported language codes
   */
  getSupportedLanguages() {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
  }

  /**
   * Check if the service is healthy
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    return {
      healthy: this.isInitialized,
      timestamp: new Date(),
      service: this.constructor.name
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.isInitialized = false;
  }

  /**
   * Get service configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update service configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default ASRService;
