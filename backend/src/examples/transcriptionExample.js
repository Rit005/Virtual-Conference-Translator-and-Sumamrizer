/**
 * TranscriptionAgent Usage Example
 * 
 * This file demonstrates how to use the enhanced TranscriptionAgent
 * with real-time audio chunk processing and event handling.
 */

import TranscriptionAgent from './agents/transcriptionAgent.js';
import AudioChunkHandler from './socket/audioChunkHandler.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import WhisperService from './services/whisper.service.js';

/**
 * Setup and initialize the transcription system
 */
async function setupTranscriptionSystem() {
  console.log('🎤 Setting up enhanced transcription system...');

  // 1. Create and configure the ASR service (Whisper)
  const whisperService = new WhisperService({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
    maxRetries: 3,
    enableDebugLogging: true
  });

  // 2. Create and configure the TranscriptionAgent
  const transcriptionAgent = new TranscriptionAgent({
    bufferSize: 5, // Process after 5 chunks
    maxBufferSize: 10, // Maximum 10 chunks in memory
    bufferTimeout: 10000, // Process after 10 seconds
    chunkDuration: 2000, // Expected 2 second chunks
    processingTimeout: 30000,
    asrService: whisperService,
    enableDebugLogging: true
  });

  // 3. Initialize the transcription agent
  const initialized = await transcriptionAgent.initialize();
  if (!initialized) {
    throw new Error('Failed to initialize TranscriptionAgent');
  }

  // 4. Set up event listeners for transcriptions
  setupTranscriptionEventListeners(transcriptionAgent);

  // 5. Create HTTP server and Socket.IO
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true
    }
  });

  // 6. Create AudioChunkHandler
  const audioChunkHandler = new AudioChunkHandler(io, transcriptionAgent, {
    maxChunkSize: 1024 * 1024, // 1MB
    enableDebugLogging: true
  });

  // 7. Initialize AudioChunkHandler
  audioChunkHandler.initialize();

  // 8. Set up Socket.IO connection handling
  setupSocketConnections(io, audioChunkHandler);

  return {
    transcriptionAgent,
    audioChunkHandler,
    io,
    httpServer
  };
}

/**
 * Set up transcription event listeners
 */
function setupTranscriptionEventListeners(transcriptionAgent) {
  transcriptionAgent.on('transcription:partial', (data) => {
    console.log(`📝 Partial transcription for session ${data.sessionId}:`, {
      text: data.text.substring(0, 50) + '...',
      confidence: data.confidence,
      language: data.language,
      isFinal: data.isFinal,
      chunkCount: data.chunkCount
    });
  });

  transcriptionAgent.on('transcription:error', (data) => {
    console.error(`❌ Transcription error for session ${data.sessionId}:`, data.error);
  });

  transcriptionAgent.on('session:started', (data) => {
    console.log(`🎬 Transcription session started: ${data.sessionId}`);
  });

  transcriptionAgent.on('session:stopped', (data) => {
    console.log(`🛑 Transcription session stopped: ${data.sessionId}`, data.stats);
  });

  transcriptionAgent.on('chunk:error', (data) => {
    console.error(`❌ Chunk error for session ${data.sessionId}:`, data.error);
  });
}

/**
 * Set up Socket.IO connection handling
 */
function setupSocketConnections(io, audioChunkHandler) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Simulate user authentication (replace with real auth)
    socket.userId = `user_${socket.id.substring(0, 8)}`;

    // Handle audio chunk streaming
    socket.on('audio:chunk', async (data) => {
      try {
        await audioChunkHandler.handleAudioChunk(socket, data);
      } catch (error) {
        console.error('Error handling audio chunk:', error);
        socket.emit('audio:chunk:error', {
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Handle stream start
    socket.on('audio:stream:start', async (data) => {
      try {
        const { sessionId, language = 'en', autoDetectLanguage = true } = data;
        await audioChunkHandler.startAudioStream(sessionId, socket.userId, {
          language,
          autoDetectLanguage
        });
      } catch (error) {
        console.error('Error starting audio stream:', error);
        socket.emit('audio:stream:error', {
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Handle stream stop
    socket.on('audio:stream:stop', async (data) => {
      try {
        const { sessionId } = data;
        await audioChunkHandler.stopAudioStream(sessionId, socket.userId);
      } catch (error) {
        console.error('Error stopping audio stream:', error);
        socket.emit('audio:stream:error', {
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      try {
        await audioChunkHandler.handleDisconnect(socket);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

    // Handle transcription:partial events (real-time captions)
    socket.on('transcription:subscribe', (data) => {
      const { sessionId } = data;
      socket.join(sessionId);
      console.log(`👥 User ${socket.userId} subscribed to session ${sessionId}`);
    });

    socket.on('transcription:unsubscribe', (data) => {
      const { sessionId } = data;
      socket.leave(sessionId);
      console.log(`👋 User ${socket.userId} unsubscribed from session ${sessionId}`);
    });
  });
}

/**
 * Example: Client-side audio chunk streaming
 */
function exampleClientStreaming() {
  return `
    // Client-side JavaScript example
    const socket = io();
    
    // Start audio stream
    socket.emit('audio:stream:start', {
      sessionId: 'conference-123',
      language: 'en',
      autoDetectLanguage: true
    });
    
    // Subscribe to transcriptions
    socket.emit('transcription:subscribe', {
      sessionId: 'conference-123'
    });
    
    // Listen for partial transcriptions
    socket.on('transcription:partial', (data) => {
      console.log('New transcription:', data.text);
      // Update UI with real-time captions
      updateCaptions(data.text, data.confidence);
    });
    
    // Send audio chunks
    async function sendAudioChunk(audioBuffer) {
      socket.emit('audio:chunk', {
        sessionId: 'conference-123',
        audioData: audioBuffer, // Base64 or Buffer
        chunkId: generateChunkId(),
        timestamp: Date.now(),
        language: 'en'
      });
    }
    
    // Stop audio stream
    socket.emit('audio:stream:stop', {
      sessionId: 'conference-123'
    });
  `;
}

/**
 * Example: Testing the transcription system
 */
async function testTranscriptionSystem() {
  try {
    console.log('🧪 Testing transcription system...');

    const { transcriptionAgent, audioChunkHandler } = await setupTranscriptionSystem();

    // Test 1: Start a transcription session
    const sessionId = 'test-session-001';
    await transcriptionAgent.startSession(sessionId, {
      language: 'en',
      autoDetectLanguage: true
    });

    console.log('✅ Test 1: Session started');

    // Test 2: Process some mock audio chunks
    const mockAudioData = Buffer.from('mock audio data'.repeat(100));
    
    for (let i = 0; i < 7; i++) {
      await transcriptionAgent.processChunk(sessionId, mockAudioData, {
        chunkId: `chunk_${i}`,
        timestamp: Date.now() + (i * 1000),
        language: 'en'
      });
      
      console.log(`✅ Test 2.${i + 1}: Chunk ${i} processed`);
      
      // Wait a bit between chunks
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test 3: Get session status
    const status = transcriptionAgent.getSessionStatus(sessionId);
    console.log('✅ Test 3: Session status:', status);

    // Test 4: Get agent statistics
    const stats = transcriptionAgent.getStats();
    console.log('✅ Test 4: Agent stats:', stats);

    // Test 5: Stop the session
    await transcriptionAgent.stopSession(sessionId);
    console.log('✅ Test 5: Session stopped');

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Example: Different ASR service integration
 */
async function exampleAlternativeASR() {
  // Example of swapping Whisper with another ASR service
  console.log('🔄 Example: Using alternative ASR service');
  
  // Create custom ASR service that implements the ASRService interface
  class CustomASRService extends ASRService {
    async transcribe(audioBuffer, options = {}) {
      // Your custom ASR implementation
      return {
        text: 'Transcribed text from custom ASR',
        language: options.language || 'en',
        confidence: 0.95,
        duration: 3.5,
        timestamp: new Date(),
        isFinal: true
      };
    }

    async initialize() {
      // Initialize your ASR service
      this.isInitialized = true;
      return true;
    }
  }

  // Use custom ASR service
  const customASR = new CustomASRService();
  const transcriptionAgent = new TranscriptionAgent({
    asrService: customASR
  });

  await transcriptionAgent.initialize();
  console.log('✅ Custom ASR service integrated');
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found in environment variables.');
      console.warn('💡 Set your OpenAI API key: export OPENAI_API_KEY=your_api_key_here');
      console.warn('📝 For testing, the system will use mock transcriptions.');
    }

    // Run tests
    await testTranscriptionSystem();

    // Start the server (comment out for testing)
    /*
    const { httpServer } = await setupTranscriptionSystem();
    const PORT = process.env.PORT || 3001;
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Transcription server running on port ${PORT}`);
    });
    */

  } catch (error) {
    console.error('💥 Main execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  setupTranscriptionSystem,
  setupTranscriptionEventListeners,
  setupSocketConnections,
  testTranscriptionSystem,
  exampleAlternativeASR
};
