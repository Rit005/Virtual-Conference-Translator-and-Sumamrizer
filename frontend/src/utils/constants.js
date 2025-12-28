// API Configuration
export const API_BASE_URL = 'http://localhost:3002/api';

// WebSocket Configuration
export const WS_BASE_URL = 'ws://localhost:3002';

// Auth Constants
export const AUTH_CONSTANTS = {
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'user_data',
  TOKEN_EXPIRY_KEY: 'token_expiry',
};

// Conference Constants
export const CONFERENCE_CONSTANTS = {
  SUPPORTED_LANGUAGES: [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
  ],
  CAPTION_UPDATE_INTERVAL: 2000, // 2 seconds
  MAX_CAPTION_HISTORY: 50,
  MAX_CHAT_MESSAGES: 100,
};

// UI Constants
export const UI_CONSTANTS = {
  TOAST_DURATION: 4000,
  SIDEBAR_WIDTH: '320px',
  HEADER_HEIGHT: '64px',
  TRANSITION_DURATION: '300ms',
};

// Theme Constants
export const THEME_CONSTANTS = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Audio Streaming Constants
export const AUDIO_CONSTANTS = {
  CHUNK_DURATION: 1000, // 1 second in milliseconds
  SAMPLE_RATE: 44100,
  CHANNELS: 1, // Mono audio
  BIT_RATE: 128000, // 128 kbps
  MIME_TYPE: 'audio/webm;codecs=opus',
  MAX_RECORDING_TIME: 300000, // 5 minutes max
  AUDIO_LEVEL_UPDATE_INTERVAL: 100, // Update audio level every 100ms
  CHUNK_SIZE_LIMIT: 1024 * 1024, // 1MB limit per chunk
};

// Message Types
export const MESSAGE_TYPES = {
  CHAT: 'chat',
  CAPTION: 'caption',
  SYSTEM: 'system',
  QUESTION: 'question',
};

// Audio Event Types
export const AUDIO_EVENTS = {
  CHUNK: 'audio:chunk',
  PERMISSION_GRANTED: 'audio:permission_granted',
  PERMISSION_DENIED: 'audio:permission_denied',
  RECORDING_STARTED: 'audio:recording_started',
  RECORDING_STOPPED: 'audio:recording_stopped',
  ERROR: 'audio:error',
};
