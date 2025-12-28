/**
 * Claude Translation Provider
 * 
 * Uses Anthropic's Claude model for high-quality text translation.
 * Supports real-time translation with streaming capabilities.
 */

import TranslationProvider from './baseProvider.js';

class ClaudeProvider extends TranslationProvider {
  constructor(options = {}) {
    super(options);
    
    this.name = 'Claude';
    this.config = {
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
      model: options.model || 'claude-3-sonnet-20240229',
      maxTokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.1, // Low temperature for consistent translations
      timeout: options.timeout || 10000,
      enableStreaming: options.enableStreaming !== false,
      baseURL: options.baseURL || 'https://api.anthropic.com/v1'
    };

    // Supported languages with metadata (same as OpenAI for consistency)
    this.supportedLanguages = {
      'en': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
      'es': { name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
      'fr': { name: 'French', flag: '🇫🇷', nativeName: 'Français' },
      'de': { name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
      'it': { name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
      'pt': { name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
      'ru': { name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
      'ja': { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
      'ko': { name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
      'zh': { name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
      'hi': { name: 'Hindi', flag: '🇮🇳', nativeName: 'हिंदी' },
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
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Initialize the Claude provider
   */
  async initialize() {
    try {
      if (!this.config.apiKey) {
        throw new Error('Anthropic API key is required');
      }

      // Test API connection (simple ping)
      const response = await this.makeRequest('messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      // Claude API returns 200 even for invalid requests, so we check if we get a proper response
      if (response.status === 401) {
        throw new Error('Invalid Anthropic API key');
      }

      this.isInitialized = true;
      this.log('Claude provider initialized successfully');
      return true;
    } catch (error) {
      this.log(`Failed to initialize Claude provider: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Translate text using Claude
   */
  async translate(text, options = {}) {
    const startTime = Date.now();
    
    try {
      this.validateText(text);

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

      // Build translation prompt
      const prompt = this.buildTranslationPrompt(text, sourceLanguage, targetLanguage);

      // Make API request
      const response = await this.makeRequest('messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: 'You are a professional translator. Translate the given text accurately and naturally. Only return the translated text, no explanations or additional content.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const translatedText = data.content[0]?.text?.trim();

      if (!translatedText) {
        throw new Error('No translation received from Claude API');
      }

      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(text, translatedText, data);

      // Update statistics
      this.updateStats(data.usage, Date.now() - startTime);

      return {
        originalText: text,
        translatedText,
        sourceLanguage: sourceLanguage === 'auto' ? await this.detectLanguage(text) : sourceLanguage,
        targetLanguage,
        confidence,
        processingTime: Date.now() - startTime,
        metadata: {
          model: data.model,
          tokens: data.usage?.input_tokens + data.usage?.output_tokens,
          stopReason: data.stop_reason
        }
      };

    } catch (error) {
      this.log(`Translation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Detect language using Claude
   */
  async detectLanguage(text) {
    try {
      const prompt = `Detect the language of this text and respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr'): "${text}"`;

      const response = await this.makeRequest('messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Language detection failed: ${response.status}`);
      }

      const data = await response.json();
      const detectedCode = data.content[0]?.text?.trim()?.toLowerCase();

      // Validate the detected language code
      if (detectedCode && this.supportedLanguages[detectedCode]) {
        return detectedCode;
      }

      // Fallback to English if detection fails
      return 'en';

    } catch (error) {
      this.log(`Language detection failed: ${error.message}`, 'warn');
      return 'en'; // Default fallback
    }
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
   * Get provider health status
   */
  async getHealthStatus() {
    try {
      const response = await this.makeRequest('messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      return {
        healthy: response.ok || response.status === 200,
        status: response.status,
        responseTime: 0,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastChecked: new Date()
      };
    }
  }

  /**
   * Get cost estimate for translation
   */
  getCostEstimate(characters) {
    // Claude pricing (approximate for Claude 3 Sonnet)
    const inputCostPerToken = 3.0 / 1000000; // $3 per 1M input tokens
    const outputCostPerToken = 15.0 / 1000000; // $15 per 1M output tokens
    
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(characters / 4);
    const estimatedCost = (estimatedTokens * inputCostPerToken) + (estimatedTokens * outputCostPerToken);

    return {
      characters,
      estimatedTokens,
      estimatedCost: Math.max(estimatedCost, 0.001), // Minimum $0.001
      currency: 'USD',
      provider: this.name,
      model: this.config.model
    };
  }

  // Private helper methods

  /**
   * Make HTTP request to Claude API
   */
  async makeRequest(endpoint, options) {
    const url = `${this.config.baseURL}/${endpoint}`;
    
    const requestOptions = {
      ...options,
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.config.timeout
    };

    return fetch(url, requestOptions);
  }

  /**
   * Build translation prompt
   */
  buildTranslationPrompt(text, sourceLanguage, targetLanguage) {
    const sourceName = sourceLanguage === 'auto' ? 'the source language' : 
      this.supportedLanguages[sourceLanguage]?.name || sourceLanguage;
    const targetName = this.supportedLanguages[targetLanguage]?.name || targetLanguage;

    return `Translate this text from ${sourceName} to ${targetName}. Maintain the original meaning, tone, and context. Only provide the translation, no additional explanations:

"${text}"`;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(originalText, translatedText, apiResponse) {
    let confidence = 0.88; // Base confidence for Claude

    // Adjust based on stop reason
    const stopReason = apiResponse.stop_reason;
    if (stopReason === 'max_tokens') {
      confidence -= 0.2; // Penalize for hitting token limit
    }

    // Adjust based on text length ratio (rough heuristic)
    const lengthRatio = translatedText.length / originalText.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      confidence -= 0.1; // Penalize for unusual length changes
    }

    // Adjust based on token usage
    const totalTokens = (apiResponse.usage?.input_tokens || 0) + (apiResponse.usage?.output_tokens || 0);
    if (totalTokens > 1000) {
      confidence -= 0.05; // Penalize for high token usage
    }

    return Math.max(0.6, Math.min(0.99, confidence));
  }

  /**
   * Update provider statistics
   */
  updateStats(usage, responseTime) {
    if (usage) {
      this.stats.totalRequests++;
      this.stats.totalTokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
      
      // Calculate cost (approximate)
      const inputCost = (usage.input_tokens || 0) * (3.0 / 1000000);
      const outputCost = (usage.output_tokens || 0) * (15.0 / 1000000);
      this.stats.totalCost += inputCost + outputCost;
    }

    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;
  }

  /**
   * Get provider statistics
   */
  getStats() {
    return {
      ...super.getStats(),
      totalRequests: this.stats.totalRequests,
      totalTokens: this.stats.totalTokens,
      totalCost: `$${this.stats.totalCost.toFixed(4)}`,
      averageResponseTime: `${this.stats.averageResponseTime.toFixed(0)}ms`,
      model: this.config.model
    };
  }
}

export default ClaudeProvider;
