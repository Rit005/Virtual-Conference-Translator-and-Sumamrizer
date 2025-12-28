/**
 * Simple TranscriptionAgent Usage Example
 * 
 * Demonstrates how to use the refined TranscriptionAgent with:
 * - Audio chunk processing
 * - Real-time transcription events
 * - Session management
 * - Error handling
 */

import TranscriptionAgent from '../agents/transcriptionAgentRefined.js';
import WhisperService from '../services/whisper.service.js';

/**
 * Example: Basic TranscriptionAgent Setup
 */
async function basicExample() {
  console.log('🎤 Basic TranscriptionAgent Example');
  
  // 1. Create ASR service (Whisper)
  const whisperService = new WhisperService({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15000, // 15 seconds
    maxRetries: 2
  });

  // 2. Create TranscriptionAgent
  const transcriptionAgent = new TranscriptionAgent({
    bufferSize: 3,        // Process after 3 chunks
    bufferTimeout: 3000,  // Or after 3 seconds
    maxRetries: 2,
    asrService: whisperService,
    enableDebugLogging: true
  });

  // 3. Initialize
  const initialized = await transcriptionAgent.initialize();
  if (!initialized) {
    throw new Error('Failed to initialize TranscriptionAgent');
  }

  // 4. Set up event listener for partial transcriptions (KEY REQUIREMENT)
  transcriptionAgent.on('transcription:partial', (data) => {
    console.log(`📝 Partial transcription for session ${data.sessionId}:`);
    console.log(`   Text: "${data.text}"`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Language: ${data.language}`);
    console.log(`   Chunks: ${data.chunkCount}`);
    console.log(`   Processing time: ${data.processingTime}ms`);
    console.log(`   Is final: ${data.isFinal}`);
    console.log('---');
  });

  // 5. Handle errors
  transcriptionAgent.on('transcription:error', (data) => {
    console.error(`❌ Transcription error for session ${data.sessionId}:`, data.error);
  });

  transcriptionAgent.on('session:started', (data) => {
    console.log(`🎬 Session started: ${data.sessionId}`);
  });

  transcriptionAgent.on('session:stopped', (data) => {
    console.log(`🛑 Session stopped: ${data.sessionId}`);
  });

  return transcriptionAgent;
}

/**
 * Example: Processing Audio Chunks
 */
async function processAudioChunks(transcriptionAgent) {
  const sessionId = 'conference-session-001';
  
  // 1. Start a session
  await transcriptionAgent.startSession(sessionId, {
    language: 'en',
    autoDetectLanguage: true
  });

  // 2. Simulate sending audio chunks (1-3 seconds each)
  const mockAudioData = Buffer.from('This is a mock audio chunk data'.repeat(50));
  
  console.log('📤 Sending audio chunks...');
  
  for (let i = 0; i < 10; i++) {
    try {
      const result = await transcriptionAgent.processChunk(sessionId, mockAudioData, {
        chunkId: `chunk_${i}`,
        timestamp: Date.now() + (i * 2000), // Simulate 2-second intervals
        language: 'en',
        userId: 'user123'
      });
      
      console.log(`✅ Chunk ${i} processed:`, {
        bufferLength: result.bufferLength,
        processingTime: result.processingTime
      });
      
      // Wait between chunks (simulating real-time audio)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.error(`❌ Failed to process chunk ${i}:`, error.message);
    }
  }

  // 3. Stop the session (processes any remaining chunks)
  await transcriptionAgent.stopSession(sessionId);
}

/**
 * Example: Real-time WebSocket Integration
 */
function websocketIntegrationExample() {
  console.log('🔌 WebSocket Integration Example');
  
  return `
    // Server-side (Node.js with Socket.IO)
    import { Server } from 'socket.io';
    import TranscriptionAgent from './agents/transcriptionAgentRefined.js';
    
    const io = new Server(server);
    const transcriptionAgent = await basicExample();
    
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Listen for transcription events and emit to clients
      transcriptionAgent.on('transcription:partial', (data) => {
        // Emit to all clients subscribed to this session
        io.to(data.sessionId).emit('transcription:partial', {
          text: data.text,
          confidence: data.confidence,
          language: data.language,
          timestamp: data.timestamp,
          isFinal: data.isFinal
        });
      });
      
      // Handle audio chunks from clients
      socket.on('audio:chunk', async (data) => {
        try {
          await transcriptionAgent.processChunk(
            data.sessionId,
            data.audioData,  // Base64 or Buffer
            {
              chunkId: data.chunkId,
              timestamp: data.timestamp,
              language: data.language,
              userId: socket.userId
            }
          );
        } catch (error) {
          socket.emit('audio:error', { error: error.message });
        }
      });
      
      // Start transcription session
      socket.on('transcription:start', async (data) => {
        try {
          await transcriptionAgent.startSession(data.sessionId, {
            language: data.language,
            autoDetectLanguage: data.autoDetectLanguage
          });
          socket.join(data.sessionId);
          socket.emit('transcription:started', { sessionId: data.sessionId });
        } catch (error) {
          socket.emit('transcription:error', { error: error.message });
        }
      });
      
      // Stop transcription session
      socket.on('transcription:stop', async (data) => {
        try {
          await transcriptionAgent.stopSession(data.sessionId);
          socket.leave(data.sessionId);
          socket.emit('transcription:stopped', { sessionId: data.sessionId });
        } catch (error) {
          socket.emit('transcription:error', { error: error.message });
        }
      });
    });
    
    // Client-side (React/JavaScript)
    const socket = io();
    
    // Subscribe to transcriptions
    socket.emit('transcription:start', { sessionId: 'my-session', language: 'en' });
    
    // Listen for real-time transcriptions
    socket.on('transcription:partial', (data) => {
      // Update UI with real-time captions
      updateCaptions(data.text, data.confidence, data.isFinal);
    });
    
    // Send audio chunks
    async function sendAudioChunk(audioBuffer) {
      socket.emit('audio:chunk', {
        sessionId: 'my-session',
        audioData: audioBuffer, // Base64 encoded audio
        chunkId: generateChunkId(),
        timestamp: Date.now(),
        language: 'en'
      });
    }
  `;
}

/**
 * Example: Swapping ASR Services
 */
async function alternativeASRExample() {
  console.log('🔄 Alternative ASR Service Example');
  
  // Example: Custom ASR Service
  class CustomASRService {
    constructor(config) {
      this.config = config;
      this.isInitialized = false;
    }

    async initialize() {
      // Initialize your custom ASR service
      this.isInitialized = true;
      return true;
    }

    async transcribe(audioBuffer, options = {}) {
      // Your custom transcription logic
      return {
        text: 'Transcribed text from custom ASR service',
        language: options.language || 'en',
        confidence: 0.95,
        duration: 3.2,
        timestamp: new Date(),
        isFinal: true
      };
    }

    validateAudioFormat(audioBuffer) {
      return {
        valid: !!audioBuffer,
        errors: [],
        size: Buffer.isBuffer(audioBuffer) ? audioBuffer.length : audioBuffer?.length || 0
      };
    }

    getAudioSize(audioBuffer) {
      return Buffer.isBuffer(audioBuffer) ? audioBuffer.length : audioBuffer?.length || 0;
    }

    async cleanup() {
      // Cleanup custom ASR resources
    }
  }

  // Use custom ASR service instead of Whisper
  const customASR = new CustomASRService();
  const transcriptionAgent = new TranscriptionAgent({
    bufferSize: 3,
    asrService: customASR,
    enableDebugLogging: true
  });

  await transcriptionAgent.initialize();
  console.log('✅ Custom ASR service integrated successfully');

  return transcriptionAgent;
}

/**
 * Example: Error Handling and Monitoring
 */
async function errorHandlingExample() {
  console.log('🛡️ Error Handling Example');
  
  const whisperService = new WhisperService({
    apiKey: 'invalid-key', // This will cause initialization to fail
    timeout: 5000
  });

  const transcriptionAgent = new TranscriptionAgent({
    bufferSize: 3,
    asrService: whisperService,
    enableDebugLogging: true
  });

  // Set up comprehensive error handling
  transcriptionAgent.on('transcription:error', (data) => {
    console.error('🚨 Transcription Error:', {
      sessionId: data.sessionId,
      error: data.error,
      timestamp: data.timestamp
    });
    
    // Here you could implement alerting, logging to external services, etc.
    if (data.error.includes('API key')) {
      console.error('💡 Check your OpenAI API key configuration');
    }
  });

  transcriptionAgent.on('chunk:error', (data) => {
    console.error('🚨 Chunk Error:', {
      sessionId: data.sessionId,
      error: data.error,
      timestamp: data.timestamp
    });
  });

  // Try to initialize (will fail gracefully)
  const initialized = await transcriptionAgent.initialize();
  if (!initialized) {
    console.log('✅ Gracefully handled initialization failure');
  }

  return transcriptionAgent;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting TranscriptionAgent Examples\n');

    // Example 1: Basic setup and usage
    console.log('=== Example 1: Basic Usage ===');
    const transcriptionAgent = await basicExample();
    await processAudioChunks(transcriptionAgent);

    console.log('\n=== Example 2: Alternative ASR Service ===');
    const customAgent = await alternativeASRExample();

    console.log('\n=== Example 3: Error Handling ===');
    const errorAgent = await errorHandlingExample();

    // Get statistics
    console.log('\n=== Agent Statistics ===');
    const stats = transcriptionAgent.getStats();
    console.log('Stats:', stats);

    // Shutdown
    await transcriptionAgent.shutdown();
    await customAgent.shutdown();
    await errorAgent.shutdown();

    console.log('\n🎉 All examples completed successfully!');

  } catch (error) {
    console.error('💥 Example execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  basicExample,
  processAudioChunks,
  websocketIntegrationExample,
  alternativeASRExample,
  errorHandlingExample
};
