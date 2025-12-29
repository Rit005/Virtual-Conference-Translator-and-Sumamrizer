/**
 * Translation Configuration
 *
 * Centralized configuration for TranslationAgent and all translation providers.
 * Supports environment-based configuration and provider-specific settings.
 */

const translationConfig = {
    // Agent-level configuration
    agent: {
      defaultProvider: process.env.TRANSLATION_DEFAULT_PROVIDER || "mock",
  
      enableCaching: process.env.TRANSLATION_ENABLE_CACHE !== "false",
      cacheSize: parseInt(process.env.TRANSLATION_CACHE_SIZE) || 1000,
      cacheTimeout: parseInt(process.env.TRANSLATION_CACHE_TIMEOUT) || 300000,
  
      maxRetries: parseInt(process.env.TRANSLATION_MAX_RETRIES) || 2,
      retryDelay: parseInt(process.env.TRANSLATION_RETRY_DELAY) || 1000,
      maxTextLength: parseInt(process.env.TRANSLATION_MAX_TEXT_LENGTH) || 10000,
  
      realTimeThreshold: parseInt(process.env.TRANSLATION_REALTIME_THRESHOLD) || 500,
      enableStreaming: process.env.TRANSLATION_ENABLE_STREAMING !== "false",
  
      enableDebugLogging: process.env.TRANSLATION_DEBUG === "true",
  
      defaultSessionTimeout:
        parseInt(process.env.TRANSLATION_SESSION_TIMEOUT) || 3600000,
      maxConcurrentSessions:
        parseInt(process.env.TRANSLATION_MAX_SESSIONS) || 100,
    },
  
    // OpenAI
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4-turbo-preview",
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
      timeout: parseInt(process.env.OPENAI_TIMEOUT) || 10000,
      enableStreaming: process.env.OPENAI_ENABLE_STREAMING !== "false",
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  
      requestsPerMinute:
        parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE) || 60,
      requestsPerDay: parseInt(process.env.OPENAI_REQUESTS_PER_DAY) || 1000,
  
      maxCostPerSession:
        parseFloat(process.env.OPENAI_MAX_COST_PER_SESSION) || 10.0,
      budgetAlerts: process.env.OPENAI_BUDGET_ALERTS === "true",
    },
  
    // Claude
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model:
        process.env.CLAUDE_TRANSLATION_MODEL ||
        "claude-3-sonnet-20240229",
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.1,
      timeout: parseInt(process.env.CLAUDE_TIMEOUT) || 10000,
      enableStreaming: process.env.CLAUDE_ENABLE_STREAMING !== "false",
      baseURL: process.env.CLAUDE_BASE_URL || "https://api.anthropic.com/v1",
  
      requestsPerMinute:
        parseInt(process.env.CLAUDE_REQUESTS_PER_MINUTE) || 50,
      requestsPerDay:
        parseInt(process.env.CLAUDE_REQUESTS_PER_DAY) || 500,
  
      maxCostPerSession:
        parseFloat(process.env.CLAUDE_MAX_COST_PER_SESSION) || 15.0,
      budgetAlerts: process.env.CLAUDE_BUDGET_ALERTS === "true",
    },
  
    // Mock provider
    mock: {
      enableRealisticTiming:
        process.env.MOCK_ENABLE_REALISTIC_TIMING !== "false",
      baseDelay: parseInt(process.env.MOCK_BASE_DELAY) || 200,
      maxDelay: parseInt(process.env.MOCK_MAX_DELAY) || 800,
      errorRate: parseFloat(process.env.MOCK_ERROR_RATE) || 0.02,
      cacheEnabled: process.env.MOCK_CACHE_ENABLED !== "false",
    },
  
    // Language config
    languages: {
      defaultSource:
        process.env.TRANSLATION_DEFAULT_SOURCE || "auto",
      defaultTarget:
        process.env.TRANSLATION_DEFAULT_TARGET || "en",
  
      supported: [
        { code: "en", name: "English", priority: 1 },
        { code: "es", name: "Spanish", priority: 1 },
        { code: "fr", name: "French", priority: 1 },
        { code: "de", name: "German", priority: 2 },
        { code: "hi", name: "Hindi", priority: 1 },
        { code: "ja", name: "Japanese", priority: 2 },
        { code: "zh", name: "Chinese", priority: 2 },
      ],
    },
  
    quality: {
      minConfidenceThreshold:
        parseFloat(process.env.TRANSLATION_MIN_CONFIDENCE) || 0.6,
      highQualityThreshold:
        parseFloat(process.env.TRANSLATION_HIGH_QUALITY) || 0.85,
    },
  
    performance: {
      maxConcurrentTranslations:
        parseInt(process.env.TRANSLATION_MAX_CONCURRENT) || 10,
    },
  };
  
  // =======================
  // Validation
  // =======================
  export function validateTranslationConfig(config) {
    const errors = [];
    const warnings = [];
  
    const validProviders = ["openai", "claude", "mock"];
    if (!validProviders.includes(config.agent.defaultProvider)) {
      errors.push(
        `Invalid default provider: ${config.agent.defaultProvider}`
      );
    }
  
    if (
      config.quality.minConfidenceThreshold < 0 ||
      config.quality.minConfidenceThreshold > 1
    ) {
      errors.push("Confidence threshold must be between 0 and 1");
    }
  
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  // =======================
  // Environment overrides
  // =======================
  export function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || "development";
  
    return {
      development: {
        agent: {
          defaultProvider: "mock",
          enableDebugLogging: true,
        },
      },
      production: {
        agent: {
          defaultProvider: "openai",
          enableDebugLogging: false,
        },
      },
      testing: {
        agent: {
          defaultProvider: "mock",
          enableCaching: false,
        },
      },
    }[env];
  }
  
  // =======================
  // Merge & finalize
  // =======================
  function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  const finalConfig = deepMerge(
    translationConfig,
    getEnvironmentConfig()
  );
  
  // Validate
  const validation = validateTranslationConfig(finalConfig);
  if (!validation.valid) {
    console.error("❌ Translation configuration invalid");
    validation.errors.forEach((e) => console.error("  ", e));
    throw new Error("Invalid translation configuration");
  }
  
  // ✅ Correct exports (NO duplicates)
  export { translationConfig };
  export default finalConfig;
  