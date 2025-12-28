/**
 * Translation Configuration
 * 
 * Centralized configuration for TranslationAgent and all translation providers.
 * Supports environment-based configuration and provider-specific settings.
 */

const translationConfig = {
  // Agent-level configuration
  agent: {
    // Default provider to use when no specific provider is configured
    defaultProvider: process.env.TRANSLATION_DEFAULT_PROVIDER || 'mock',
    
    // Enable caching for better performance
    enableCaching: process.env.TRANSLATION_ENABLE_CACHE !== 'false',
    cacheSize: parseInt(process.env.TRANSLATION_CACHE_SIZE) || 1000,
    cacheTimeout: parseInt(process.env.TRANSLATION_CACHE_TIMEOUT) || 300000, // 5 minutes
    
    // Processing settings
    maxRetries: parseInt(process.env.TRANSLATION_MAX_RETRIES) || 2,
    retryDelay: parseInt(process.env.TRANSLATION_RETRY_DELAY) || 1000,
    maxTextLength: parseInt(process.env.TRANSLATION_MAX_TEXT_LENGTH) || 10000,
    
    // Real-time settings
    realTimeThreshold: parseInt(process.env.TRANSLATION_REALTIME_THRESHOLD) || 500,
    enableStreaming: process.env.TRANSLATION_ENABLE_STREAMING !== 'false',
    
    // Debug and logging
    enableDebugLogging: process.env.TRANSLATION_DEBUG === 'true',
    
    // Session management
    defaultSessionTimeout: parseInt(process.env.TRANSLATION_SESSION_TIMEOUT) || 3600000, // 1 hour
    maxConcurrentSessions: parseInt(process.env.TRANSLATION_MAX_SESSIONS) || 100
  },

  // OpenAI provider configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 10000,
    enableStreaming: process.env.OPENAI_ENABLE_STREAMING !== 'false',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    
    // Rate limiting
    requestsPerMinute: parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE) || 60,
    requestsPerDay: parseInt(process.env.OPENAI_REQUESTS_PER_DAY) || 1000,
    
    // Cost management
    maxCostPerSession: parseFloat(process.env.OPENAI_MAX_COST_PER_SESSION) || 10.0,
    budgetAlerts: process.env.OPENAI_BUDGET_ALERTS === 'true'
  },

  // Claude provider configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_TRANSLATION_MODEL || 'claude-3-sonnet-20240229',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.1,
    timeout: parseInt(process.env.CLAUDE_TIMEOUT) || 10000,
    enableStreaming: process.env.CLAUDE_ENABLE_STREAMING !== 'false',
    baseURL: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
    
    // Rate limiting
    requestsPerMinute: parseInt(process.env.CLAUDE_REQUESTS_PER_MINUTE) || 50,
    requestsPerDay: parseInt(process.env.CLAUDE_REQUESTS_PER_DAY) || 500,
    
    // Cost management
    maxCostPerSession: parseFloat(process.env.CLAUDE_MAX_COST_PER_SESSION) || 15.0,
    budgetAlerts: process.env.CLAUDE_BUDGET_ALERTS === 'true'
  },

  // Mock provider configuration (for development/testing)
  mock: {
    enableRealisticTiming: process.env.MOCK_ENABLE_REALISTIC_TIMING !== 'false',
    baseDelay: parseInt(process.env.MOCK_BASE_DELAY) || 200,
    maxDelay: parseInt(process.env.MOCK_MAX_DELAY) || 800,
    errorRate: parseFloat(process.env.MOCK_ERROR_RATE) || 0.02,
    cacheEnabled: process.env.MOCK_CACHE_ENABLED !== 'false'
  },

  // Google Translate provider (future implementation)
  googleTranslate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
    projectId: process.env.GOOGLE_TRANSLATE_PROJECT_ID,
    location: process.env.GOOGLE_TRANSLATE_LOCATION || 'global',
    timeout: parseInt(process.env.GOOGLE_TRANSLATE_TIMEOUT) || 10000,
    
    // Rate limiting
    requestsPerMinute: parseInt(process.env.GOOGLE_REQUESTS_PER_MINUTE) || 100,
    characterLimitPerRequest: parseInt(process.env.GOOGLE_CHARACTER_LIMIT) || 50000
  },

  // Azure Translator configuration (future implementation)
  azure: {
    apiKey: process.env.AZURE_TRANSLATOR_KEY,
    region: process.env.AZURE_TRANSLATOR_REGION,
    endpoint: process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
    timeout: parseInt(process.env.AZURE_TRANSLATOR_TIMEOUT) || 10000,
    
    // Rate limiting
    requestsPerSecond: parseInt(process.env.AZURE_REQUESTS_PER_SECOND) || 10,
    characterLimitPerHour: parseInt(process.env.AZURE_CHARACTER_LIMIT) || 2000000
  },

  // Language configuration
  languages: {
    // Default source language
    defaultSource: process.env.TRANSLATION_DEFAULT_SOURCE || 'auto',
    
    // Default target language
    defaultTarget: process.env.TRANSLATION_DEFAULT_TARGET || 'en',
    
    // Supported languages with priority (affects provider selection)
    supported: [
      { code: 'en', name: 'English', flag: '🇺🇸', priority: 1 },
      { code: 'es', name: 'Spanish', flag: '🇪🇸', priority: 1 },
      { code: 'fr', name: 'French', flag: '🇫🇷', priority: 1 },
      { code: 'de', name: 'German', flag: '🇩🇪', priority: 2 },
      { code: 'it', name: 'Italian', flag: '🇮🇹', priority: 2 },
      { code: 'pt', name: 'Portuguese', flag: '🇵🇹', priority: 2 },
      { code: 'hi', name: 'Hindi', flag: '🇮🇳', priority: 1 },
      { code: 'ja', name: 'Japanese', flag: '🇯🇵', priority: 2 },
      { code: 'ko', name: 'Korean', flag: '🇰🇷', priority: 2 },
      { code: 'zh', name: 'Chinese', flag: '🇨🇳', priority: 2 },
      { code: 'ar', name: 'Arabic', flag: '🇸🇦', priority: 3 },
      { code: 'ru', name: 'Russian', flag: '🇷🇺', priority: 3 },
      { code: 'nl', name: 'Dutch', flag: '🇳🇱', priority: 3 }
    ],
    
    // Language pairs with enhanced support
    enhancedPairs: [
      { source: 'en', target: 'es', providers: ['openai', 'claude', 'mock'] },
      { source: 'en', target: 'fr', providers: ['openai', 'claude', 'mock'] },
      { source: 'en', target: 'de', providers: ['openai', 'claude', 'mock'] },
      { source: 'en', target: 'hi', providers: ['openai', 'claude', 'mock'] },
      { source: 'en', target: 'ja', providers: ['claude', 'openai', 'mock'] },
      { source: 'en', target: 'zh', providers: ['claude', 'openai', 'mock'] },
      { source: 'es', target: 'en', providers: ['openai', 'claude', 'mock'] },
      { source: 'fr', target: 'en', providers: ['openai', 'claude', 'mock'] },
      { source: 'hi', target: 'en', providers: ['openai', 'claude', 'mock'] }
    ]
  },

  // Quality and confidence settings
  quality: {
    // Minimum confidence threshold for accepting translations
    minConfidenceThreshold: parseFloat(process.env.TRANSLATION_MIN_CONFIDENCE) || 0.6,
    
    // Confidence threshold for high-quality translations
    highQualityThreshold: parseFloat(process.env.TRANSLATION_HIGH_QUALITY) || 0.85,
    
    // Enable confidence-based provider fallback
    enableConfidenceFallback: process.env.TRANSLATION_CONFIDENCE_FALLBACK !== 'false',
    
    // Text quality checks
    enableQualityChecks: process.env.TRANSLATION_QUALITY_CHECKS !== 'false',
    maxLengthRatio: parseFloat(process.env.TRANSLATION_MAX_LENGTH_RATIO) || 2.0,
    minLengthRatio: parseFloat(process.env.TRANSLATION_MIN_LENGTH_RATIO) || 0.5
  },

  // Performance settings
  performance: {
    // Enable performance monitoring
    enableMonitoring: process.env.TRANSLATION_ENABLE_MONITORING !== 'false',
    
    // Performance thresholds (milliseconds)
    targetResponseTime: parseInt(process.env.TRANSLATION_TARGET_RESPONSE_TIME) || 1000,
    maxAcceptableResponseTime: parseInt(process.env.TRANSLATION_MAX_RESPONSE_TIME) || 3000,
    
    // Batch processing
    enableBatchProcessing: process.env.TRANSLATION_BATCH_ENABLED !== 'false',
    batchSize: parseInt(process.env.TRANSLATION_BATCH_SIZE) || 5,
    batchTimeout: parseInt(process.env.TRANSLATION_BATCH_TIMEOUT) || 1000,
    
    // Concurrent processing
    maxConcurrentTranslations: parseInt(process.env.TRANSLATION_MAX_CONCURRENT) || 10,
    
    // Memory management
    maxMemoryUsage: parseInt(process.env.TRANSLATION_MAX_MEMORY) || 500 * 1024 * 1024, // 500MB
    gcThreshold: parseInt(process.env.TRANSLATION_GC_THRESHOLD) || 100 * 1024 * 1024 // 100MB
  },

  // Monitoring and analytics
  monitoring: {
    // Enable detailed analytics
    enableAnalytics: process.env.TRANSLATION_ENABLE_ANALYTICS !== 'false',
    
    // Metrics collection
    collectProviderMetrics: process.env.TRANSLATION_PROVIDER_METRICS !== 'false',
    collectQualityMetrics: process.env.TRANSLATION_QUALITY_METRICS !== 'false',
    collectPerformanceMetrics: process.env.TRANSLATION_PERFORMANCE_METRICS !== 'false',
    
    // Reporting
    enableReports: process.env.TRANSLATION_ENABLE_REPORTS !== 'false',
    reportInterval: parseInt(process.env.TRANSLATION_REPORT_INTERVAL) || 3600000, // 1 hour
    
    // Alerting
    enableAlerts: process.env.TRANSLATION_ENABLE_ALERTS !== 'false',
    alertThresholds: {
      errorRate: parseFloat(process.env.TRANSLATION_ALERT_ERROR_RATE) || 0.05,
      responseTime: parseInt(process.env.TRANSLATION_ALERT_RESPONSE_TIME) || 5000,
      costPerSession: parseFloat(process.env.TRANSLATION_ALERT_COST) || 50.0
    }
  },

  // Security settings
  security: {
    // Input validation
    enableInputValidation: process.env.TRANSLATION_VALIDATE_INPUT !== 'false',
    maxInputLength: parseInt(process.env.TRANSLATION_MAX_INPUT_LENGTH) || 50000,
    
    // Content filtering
    enableContentFiltering: process.env.TRANSLATION_CONTENT_FILTER !== 'true',
    blockedPatterns: process.env.TRANSLATION_BLOCKED_PATTERNS ? 
      process.env.TRANSLATION_BLOCKED_PATTERNS.split(',') : [],
    
    // API key security
    encryptApiKeys: process.env.TRANSLATION_ENCRYPT_KEYS === 'true',
    keyRotationInterval: parseInt(process.env.TRANSLATION_KEY_ROTATION) || 86400000, // 24 hours
    
    // Rate limiting per session
    maxTranslationsPerSession: parseInt(process.env.TRANSLATION_MAX_PER_SESSION) || 1000,
    sessionRateLimit: parseInt(process.env.TRANSLATION_SESSION_RATE_LIMIT) || 10 // per minute
  },

  // Feature flags
  features: {
    // Enable experimental features
    enableExperimental: process.env.TRANSLATION_EXPERIMENTAL === 'true',
    
    // Real-time streaming
    enableRealTimeStreaming: process.env.TRANSLATION_REALTIME_STREAMING !== 'false',
    
    // Dynamic provider selection
    enableDynamicProviderSelection: process.env.TRANSLATION_DYNAMIC_PROVIDERS !== 'false',
    
    // Quality-based routing
    enableQualityRouting: process.env.TRANSLATION_QUALITY_ROUTING !== 'false',
    
    // Auto-scaling
    enableAutoScaling: process.env.TRANSLATION_AUTO_SCALING === 'true',
    
    // Predictive caching
    enablePredictiveCaching: process.env.TRANSLATION_PREDICTIVE_CACHE === 'true'
  }
};

// Validation function for configuration
export function validateTranslationConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate required environment variables
  const requiredEnvVars = [];
  
  // Check default provider
  const validProviders = ['openai', 'claude', 'mock'];
  if (!validProviders.includes(config.agent.defaultProvider)) {
    errors.push(`Invalid default provider: ${config.agent.defaultProvider}. Must be one of: ${validProviders.join(', ')}`);
  }

  // Validate timeout values
  if (config.agent.retryDelay < 100) {
    warnings.push('Retry delay is very low, may cause rate limiting issues');
  }
  
  if (config.agent.realTimeThreshold > 2000) {
    warnings.push('Real-time threshold is high, may not provide optimal user experience');
  }

  // Validate API keys for enabled providers
  if (config.agent.defaultProvider === 'openai' && !config.openai.apiKey) {
    errors.push('OpenAI API key is required when using OpenAI as default provider');
  }
  
  if (config.agent.defaultProvider === 'claude' && !config.claude.apiKey) {
    errors.push('Claude API key is required when using Claude as default provider');
  }

  // Validate numeric ranges
  if (config.quality.minConfidenceThreshold < 0 || config.quality.minConfidenceThreshold > 1) {
    errors.push('Minimum confidence threshold must be between 0 and 1');
  }
  
  if (config.performance.maxConcurrentTranslations < 1) {
    errors.push('Max concurrent translations must be at least 1');
  }

  // Validate memory settings
  if (config.performance.maxMemoryUsage < 50 * 1024 * 1024) {
    warnings.push('Max memory usage is very low, may cause performance issues');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Environment-specific configuration overrides
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const envOverrides = {
    development: {
      agent: {
        enableDebugLogging: true,
        defaultProvider: 'mock'
      },
      monitoring: {
        enableAnalytics: true,
        enableReports: true
      }
    },
    
    production: {
      agent: {
        enableDebugLogging: false,
        defaultProvider: process.env.PRODUCTION_TRANSLATION_PROVIDER || 'openai'
      },
      monitoring: {
        enableAnalytics: true,
        enableReports: true,
        enableAlerts: true
      },
      security: {
        encryptApiKeys: true
      }
    },
    
    testing: {
      agent: {
        defaultProvider: 'mock',
        enableCaching: false
      },
      performance: {
        enableMonitoring: false
      }
    }
  };

  return envOverrides[env] || {};
}

// Apply environment-specific overrides
const environmentOverrides = getEnvironmentConfig();
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const finalConfig = deepMerge(translationConfig, environmentOverrides);

// Validate final configuration
const validation = validateTranslationConfig(finalConfig);
if (!validation.valid) {
  console.error('❌ Translation configuration validation failed:');
  validation.errors.forEach(error => console.error(`   ${error}`));
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`   ${warning}`));
  }
  
  throw new Error('Invalid translation configuration');
}

export default finalConfig;
export { translationConfig, validateTranslationConfig, getEnvironmentConfig };
