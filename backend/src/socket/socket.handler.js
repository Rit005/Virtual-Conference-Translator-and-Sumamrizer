import { prisma } from '../prismaClient.js';
import transcriptionAgentRefined from '../agents/transcriptionAgentRefined.js';
import TranslationAgent from '../agents/translationAgent.js';
import summarizationAgent from '../agents/summarizationAgent.js';
import { verifyToken } from '../utils/jwt.js';
import AudioChunkHandler from './audioChunkHandler.js';
import translationConfig from '../config/translationConfig.js';

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.sessionUsers = new Map(); // sessionId -> Set of userIds
    this.userLanguagePreferences = new Map(); // userId -> preferredLanguage
    this.liveCaptionIntervals = new Map(); // sessionId -> interval data
    
    // Initialize TranslationAgent with production-ready configuration
    this.translationAgent = new TranslationAgent(translationConfig.agent);
    
    // Initialize AudioChunkHandler with clean architecture
    this.audioChunkHandler = new AudioChunkHandler(io, transcriptionAgentRefined, {
      chunkBufferSize: 10,
      maxChunkSize: 1024 * 1024, // 1MB
      processingTimeout: 30000, // 30 seconds
      enableDebugLogging: true
    });
  }

  /**
   * Initialize Socket.IO event handlers
   */
  async initialize() {
    try {
      // Initialize TranslationAgent with production-ready configuration
      const translationInitialized = await this.translationAgent.initialize();
      if (!translationInitialized) {
        console.warn('⚠️ TranslationAgent initialization failed, using fallback mode');
      } else {
        console.log('✅ TranslationAgent initialized successfully');
      }

      // Set up translation event listeners for real-time caption translation
      this.setupTranslationEventHandlers();

      // Initialize AudioChunkHandler with event-driven setup
      this.audioChunkHandler.initialize();
      
      // Initialize connection handlers
      this.initializeConnectionHandlers();
      
      console.log('✅ SocketHandler initialized with TranslationAgent integration');
      
    } catch (error) {
      console.error('❌ SocketHandler initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers for TranslationAgent integration
   */
  setupTranslationEventHandlers() {
    // Listen to transcription events from TranscriptionAgentRefined and translate them
    transcriptionAgentRefined.on('transcription:partial', async (transcriptionData) => {
      try {
        console.log(`📝 Received transcription for translation: "${transcriptionData.text.substring(0, 50)}..."`);
        
        // Process transcription through TranslationAgent
        await this.translationAgent.processTranscription(
          transcriptionData.sessionId,
          transcriptionData
        );
        
      } catch (error) {
        console.error(`❌ Translation processing failed for session ${transcriptionData.sessionId}:`, error.message);
      }
    });

    // Listen to translation events and broadcast to clients
    this.translationAgent.on('translation:partial', (translationData) => {
      console.log(`🌍 Translation completed: "${translationData.originalText.substring(0, 30)}..." → "${translationData.translatedText.substring(0, 30)}..."`);
      
      // Broadcast to all users in the session
      this.io.to(translationData.sessionId).emit('translation:partial', {
        sessionId: translationData.sessionId,
        originalText: translationData.originalText,
        translatedText: translationData.translatedText,
        sourceLanguage: translationData.sourceLanguage,
        targetLanguage: translationData.targetLanguage,
        confidence: translationData.confidence,
        provider: translationData.provider,
        isFinal: translationData.isFinal,
        chunkCount: translationData.chunkCount,
        processingTime: translationData.processingTime,
        timestamp: translationData.timestamp
      });
    });

    // Handle translation errors
    this.translationAgent.on('translation:error', (errorData) => {
      console.error(`❌ Translation error for session ${errorData.sessionId}:`, errorData.error);
      
      // Broadcast error to session users
      this.io.to(errorData.sessionId).emit('translation:error', {
        sessionId: errorData.sessionId,
        error: errorData.error,
        originalText: errorData.originalText,
        timestamp: errorData.timestamp
      });
    });

    // Handle session events
    this.translationAgent.on('translation:session:started', (sessionData) => {
      console.log(`🎬 Translation session started: ${sessionData.sessionId} (${sessionData.targetLanguage})`);
    });

    this.translationAgent.on('translation:session:stopped', (sessionData) => {
      console.log(`🏁 Translation session stopped: ${sessionData.sessionId}`);
    });

    this.translationAgent.on('translation:language:changed', (changeData) => {
      console.log(`🔄 Language changed for session ${changeData.sessionId}: ${changeData.oldLanguage} → ${changeData.newLanguage}`);
      
      // Notify session users about language change
      this.io.to(changeData.sessionId).emit('translation:language:changed', {
        sessionId: changeData.sessionId,
        oldLanguage: changeData.oldLanguage,
        newLanguage: changeData.newLanguage,
        timestamp: changeData.timestamp
      });
    });

    console.log('🔗 Translation event handlers set up successfully');
  }

  /**
   * Initialize Socket.IO connection handlers
   */
  initializeConnectionHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', async (data) => {
        try {
          const { token } = data;
          
          // Verify JWT token
          if (!token) {
            socket.emit('authentication_error', { 
              message: 'No token provided' 
            });
            return;
          }

          const decoded = verifyToken(token);
          
          socket.userId = decoded.id;
          socket.userName = decoded.email; // Using email as name for now
          socket.userRole = decoded.role;
          
          this.connectedUsers.set(socket.userId, socket.id);
          
          socket.emit('authenticated', { 
            success: true, 
            message: 'Authentication successful',
            user: {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role
            }
          });
          
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authentication_error', { 
            message: 'Authentication failed',
            error: error.message
          });
        }
      });

      // Handle creating or joining a session
      socket.on('join_session', async (data) => {
        try {
          const { sessionId, targetLanguage = 'en' } = data;
          
          // First, try to find existing session
          let session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
              participants: {
                where: { userId: socket.userId }
              }
            }
          });

          // If session doesn't exist, create it
          if (!session) {
            console.log(`Creating new session: ${sessionId}`);
            
            try {
              // Create new session
              session = await prisma.session.create({
                data: {
                  id: sessionId,
                  title: `Conference ${new Date().toLocaleDateString()}`,
                  description: 'Real-time conference with translation and summarization',
                  hostId: socket.userId,
                  language: 'en',
                  maxUsers: 100,
                  status: 'CREATED',
                  isLive: false
                },
                include: {
                  participants: true
                }
              });

              // Add creator as host participant
              await prisma.sessionParticipant.create({
                data: {
                  sessionId: sessionId,
                  userId: socket.userId
                }
              });

              console.log(`Created new session: ${sessionId} by user ${socket.userId}`);

            } catch (createError) {
              // If there's a duplicate key error, session might have been created by another request
              if (createError.code === 'P2002') {
                // Try to get the existing session again
                session = await prisma.session.findUnique({
                  where: { id: sessionId },
                  include: {
                    participants: {
                      where: { userId: socket.userId }
                    }
                  }
                });
              } else {
                throw createError;
              }
            }
          }

          // Verify session exists after creation attempt
          if (!session) {
            socket.emit('error', { message: 'Failed to create or find session' });
            return;
          }

          // Check if user is already a participant
          const existingParticipant = session.participants.find(
            p => p.userId === socket.userId
          );

          // Add user as participant if not already added
          if (!existingParticipant) {
            await prisma.sessionParticipant.create({
              data: {
                sessionId,
                userId: socket.userId
              }
            });
          }

          // Join socket room
          socket.join(sessionId);
          
          // Track session users
          if (!this.sessionUsers.has(sessionId)) {
            this.sessionUsers.set(sessionId, new Set());
          }
          this.sessionUsers.get(sessionId).add(socket.userId);

          // Notify other users in the session
          socket.to(sessionId).emit('user_joined', {
            userId: socket.userId,
            userName: socket.userName,
            timestamp: new Date()
          });

          // Get updated participant count
          const participantCount = await prisma.sessionParticipant.count({
            where: { sessionId }
          });

          socket.emit('session_joined', {
            sessionId,
            message: 'Successfully joined session',
            session: {
              id: session.id,
              title: session.title,
              status: session.status,
              isLive: session.isLive,
              participantCount
            }
          });

          // Notify about participant count change
          this.io.to(sessionId).emit('participant_count_update', {
            sessionId,
            count: participantCount
          });

          console.log(`User ${socket.userId} joined session ${sessionId} (${participantCount} participants)`);

          // Initialize TranslationAgent session for this user
          try {
            await this.translationAgent.startSession(`${sessionId}_${socket.userId}`, {
              targetLanguage,
              sourceLanguage: 'auto',
              provider: translationConfig.agent.defaultProvider
            });
            console.log(`🎬 TranslationAgent session initialized for user ${socket.userId} in ${sessionId}`);
          } catch (translationError) {
            console.warn(`⚠️ TranslationAgent session initialization failed for user ${socket.userId}:`, translationError.message);
          }

        } catch (error) {
          console.error('Join session error:', error);
          socket.emit('error', { message: 'Failed to join session: ' + error.message });
        }
      });

      // Handle leaving a session
      socket.on('leave_session', async (data) => {
        try {
          const { sessionId } = data;
          
          // Leave socket room
          socket.leave(sessionId);
          
          // Remove from session users tracking
          if (this.sessionUsers.has(sessionId)) {
            this.sessionUsers.get(sessionId).delete(socket.userId);
            if (this.sessionUsers.get(sessionId).size === 0) {
              this.sessionUsers.delete(sessionId);
            }
          }

          // Notify other users in the session
          socket.to(sessionId).emit('user_left', {
            userId: socket.userId,
            userName: socket.userName,
            timestamp: new Date()
          });

          socket.emit('session_left', {
            sessionId,
            message: 'Successfully left session'
          });

          console.log(`User ${socket.userId} left session ${sessionId}`);

        } catch (error) {
          console.error('Leave session error:', error);
          socket.emit('error', { message: 'Failed to leave session' });
        }
      });

      // Handle chat messages
      socket.on('chat_message', async (data) => {
        try {
          const { sessionId, text } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Save message to database
          const message = await prisma.message.create({
            data: {
              sessionId,
              userId: socket.userId,
              text
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });

          // Broadcast message to all users in session
          this.io.to(sessionId).emit('new_message', {
            id: message.id,
            text: message.text,
            timestamp: message.timestamp,
            user: message.user,
            isQuestion: message.isQuestion,
            isPinned: message.isPinned,
            questionCategory: message.questionCategory,
            likes: message.likes
          });

          // Generate real-time summary update using summarization agent
          const recentMessages = await prisma.message.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'desc' },
            take: 10,
            include: {
              user: {
                select: { name: true }
              }
            }
          });

          const recentCaptions = await prisma.caption.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'desc' },
            take: 5
          });

          const update = await summarizationAgent.generateRealtimeUpdate(
            recentCaptions,
            recentMessages,
            { sessionId, updateType: 'key_points' }
          );
          
          this.io.to(sessionId).emit('summary_update', update);

        } catch (error) {
          console.error('Chat message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle marking messages as questions
      socket.on('mark_as_question', async (data) => {
        try {
          const { messageId, questionCategory } = data;
          
          // Get the message to verify session authorization
          const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          });

          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify user is in session
          const sessionId = message.sessionId;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Update message to mark as question
          const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
              isQuestion: true,
              questionCategory: questionCategory || null
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });

          // Broadcast update to all users in session
          this.io.to(sessionId).emit('message_updated', {
            id: updatedMessage.id,
            text: updatedMessage.text,
            timestamp: updatedMessage.timestamp,
            user: updatedMessage.user,
            isQuestion: updatedMessage.isQuestion,
            isPinned: updatedMessage.isPinned,
            questionCategory: updatedMessage.questionCategory,
            likes: updatedMessage.likes
          });

          console.log(`Message ${messageId} marked as question by user ${socket.userId}`);

        } catch (error) {
          console.error('Mark as question error:', error);
          socket.emit('error', { message: 'Failed to mark message as question' });
        }
      });

      // Handle unmarking messages as questions
      socket.on('unmark_as_question', async (data) => {
        try {
          const { messageId } = data;
          
          // Get the message to verify session authorization
          const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          });

          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify user is in session
          const sessionId = message.sessionId;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // If message is pinned, unpin it first
          if (message.isPinned) {
            await prisma.message.update({
              where: { id: messageId },
              data: {
                isPinned: false,
                pinnedAt: null,
                pinnedById: null
              }
            });
          }

          // Update message to unmark as question
          const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
              isQuestion: false,
              questionCategory: null
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });

          // Broadcast update to all users in session
          this.io.to(sessionId).emit('message_updated', {
            id: updatedMessage.id,
            text: updatedMessage.text,
            timestamp: updatedMessage.timestamp,
            user: updatedMessage.user,
            isQuestion: updatedMessage.isQuestion,
            isPinned: updatedMessage.isPinned,
            questionCategory: updatedMessage.questionCategory,
            likes: updatedMessage.likes
          });

          console.log(`Message ${messageId} unmarked as question by user ${socket.userId}`);

        } catch (error) {
          console.error('Unmark as question error:', error);
          socket.emit('error', { message: 'Failed to unmark message as question' });
        }
      });

      // Handle pinning questions (moderator only)
      socket.on('pin_question', async (data) => {
        try {
          const { messageId } = data;
          
          // Get the message to verify session authorization
          const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          });

          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify user is in session and has moderator/host role
          const sessionId = message.sessionId;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          if (!['MODERATOR', 'HOST'].includes(socket.userRole)) {
            socket.emit('error', { message: 'Only moderators can pin questions' });
            return;
          }

          // Update message to pin it
          const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
              isPinned: true,
              pinnedAt: new Date(),
              pinnedById: socket.userId
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              },
              pinnedBy: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });

          // Broadcast update to all users in session
          this.io.to(sessionId).emit('message_updated', {
            id: updatedMessage.id,
            text: updatedMessage.text,
            timestamp: updatedMessage.timestamp,
            user: updatedMessage.user,
            isQuestion: updatedMessage.isQuestion,
            isPinned: updatedMessage.isPinned,
            pinnedAt: updatedMessage.pinnedAt,
            pinnedBy: updatedMessage.pinnedBy,
            questionCategory: updatedMessage.questionCategory,
            likes: updatedMessage.likes
          });

          console.log(`Question ${messageId} pinned by moderator ${socket.userId}`);

        } catch (error) {
          console.error('Pin question error:', error);
          socket.emit('error', { message: 'Failed to pin question' });
        }
      });

      // Handle unpinning questions (moderator only)
      socket.on('unpin_question', async (data) => {
        try {
          const { messageId } = data;
          
          // Get the message to verify session authorization
          const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          });

          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify user is in session and has moderator/host role
          const sessionId = message.sessionId;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          if (!['MODERATOR', 'HOST'].includes(socket.userRole)) {
            socket.emit('error', { message: 'Only moderators can unpin questions' });
            return;
          }

          // Update message to unpin it
          const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
              isPinned: false,
              pinnedAt: null,
              pinnedById: null
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            }
          });

          // Broadcast update to all users in session
          this.io.to(sessionId).emit('message_updated', {
            id: updatedMessage.id,
            text: updatedMessage.text,
            timestamp: updatedMessage.timestamp,
            user: updatedMessage.user,
            isQuestion: updatedMessage.isQuestion,
            isPinned: updatedMessage.isPinned,
            pinnedAt: updatedMessage.pinnedAt,
            pinnedBy: updatedMessage.pinnedBy,
            questionCategory: updatedMessage.questionCategory,
            likes: updatedMessage.likes
          });

          console.log(`Question ${messageId} unpinned by moderator ${socket.userId}`);

        } catch (error) {
          console.error('Unpin question error:', error);
          socket.emit('error', { message: 'Failed to unpin question' });
        }
      });

      // Handle getting pinned questions for session
      socket.on('get_pinned_questions', async (data) => {
        try {
          const { sessionId } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Get all pinned questions for this session
          const pinnedQuestions = await prisma.message.findMany({
            where: {
              sessionId,
              isPinned: true
            },
            orderBy: {
              pinnedAt: 'desc'
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              },
              pinnedBy: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });

          socket.emit('pinned_questions', {
            sessionId,
            questions: pinnedQuestions.map(q => ({
              id: q.id,
              text: q.text,
              timestamp: q.timestamp,
              user: q.user,
              isQuestion: q.isQuestion,
              isPinned: q.isPinned,
              pinnedAt: q.pinnedAt,
              pinnedBy: q.pinnedBy,
              questionCategory: q.questionCategory,
              likes: q.likes
            }))
          });

        } catch (error) {
          console.error('Get pinned questions error:', error);
          socket.emit('error', { message: 'Failed to get pinned questions' });
        }
      });

      // Handle liking messages
      socket.on('like_message', async (data) => {
        try {
          const { messageId } = data;
          
          // Get the message to verify session authorization
          const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          });

          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify user is in session
          const sessionId = message.sessionId;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Check if user already liked this message
          const existingLike = await prisma.messageLike.findUnique({
            where: {
              messageId_userId: {
                messageId,
                userId: socket.userId
              }
            }
          });

          let updatedMessage;

          if (existingLike) {
            // Unlike the message
            await prisma.messageLike.delete({
              where: {
                messageId_userId: {
                  messageId,
                  userId: socket.userId
                }
              }
            });

            updatedMessage = await prisma.message.update({
              where: { id: messageId },
              data: {
                likes: { decrement: 1 }
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              }
            });

          } else {
            // Like the message
            await prisma.messageLike.create({
              data: {
                messageId,
                userId: socket.userId
              }
            });

            updatedMessage = await prisma.message.update({
              where: { id: messageId },
              data: {
                likes: { increment: 1 }
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              }
            });
          }

          // Broadcast update to all users in session
          this.io.to(sessionId).emit('message_updated', {
            id: updatedMessage.id,
            text: updatedMessage.text,
            timestamp: updatedMessage.timestamp,
            user: updatedMessage.user,
            isQuestion: updatedMessage.isQuestion,
            isPinned: updatedMessage.isPinned,
            questionCategory: updatedMessage.questionCategory,
            likes: updatedMessage.likes
          });

          console.log(`Message ${messageId} ${existingLike ? 'unliked' : 'liked'} by user ${socket.userId}`);

        } catch (error) {
          console.error('Like message error:', error);
          socket.emit('error', { message: 'Failed to like message' });
        }
      });

      // Handle audio chunks using dedicated AudioChunkHandler
      socket.on('audio:chunk', async (data) => {
        try {
          // Verify user is in session first
          const { sessionId } = data;
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            console.warn('⚠️ Audio chunk from unauthorized user:', {
              userId: socket.userId,
              sessionId,
              chunkId: data.chunkId
            });
            return;
          }

          // Delegate to AudioChunkHandler with clean architecture
          await this.audioChunkHandler.handleAudioChunk(socket, data);

        } catch (error) {
          console.error('❌ Audio chunk delegation error:', error);
          socket.emit('audio:error', {
            sessionId: data.sessionId,
            chunkId: data.chunkId,
            error: error.message,
            timestamp: Date.now()
          });
        }
      });

      // Handle audio stream control events
      socket.on('audio:stream:start', async (data) => {
        try {
          const { sessionId } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Start audio stream using AudioChunkHandler
          await this.audioChunkHandler.startAudioStream(sessionId, socket.userId);

        } catch (error) {
          console.error('❌ Audio stream start error:', error);
          socket.emit('audio:stream:error', {
            sessionId: data.sessionId,
            error: error.message,
            timestamp: Date.now()
          });
        }
      });

      socket.on('audio:stream:stop', async (data) => {
        try {
          const { sessionId } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          // Stop audio stream using AudioChunkHandler
          await this.audioChunkHandler.stopAudioStream(sessionId, socket.userId);

        } catch (error) {
          console.error('❌ Audio stream stop error:', error);
          socket.emit('audio:stream:error', {
            sessionId: data.sessionId,
            error: error.message,
            timestamp: Date.now()
          });
        }
      });

      socket.on('audio:stream:status', (data) => {
        try {
          const { sessionId } = data;
          const status = this.audioChunkHandler.getStreamStatus(sessionId);
          
          socket.emit('audio:stream:status:response', {
            sessionId,
            status,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('❌ Audio stream status error:', error);
          socket.emit('error', { message: 'Failed to get stream status' });
        }
      });

      // Handle live captions simulation (every 3 seconds)
      socket.on('start_live_captions', async (data) => {
        try {
          const { sessionId, language = 'en' } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            return;
          }

          console.log(`🎬 Starting live captions for session ${sessionId}`);

          // Start simulated live captions
          const stopCaptions = () => {
            clearInterval(captionInterval);
            console.log(`🛑 Stopped live captions for session ${sessionId}`);
          };

          const captionInterval = setInterval(async () => {
            try {
              // Generate a new caption using transcription agent
              const transcription = await transcriptionAgentRefined.transcribeAudioChunk(
                sessionId,
                'mock-audio-data',
                language
              );

              // Save caption to database
              const caption = await prisma.caption.create({
                data: {
                  sessionId,
                  text: transcription.text,
                  language: transcription.language
                }
              });

              // NOTE: Translation will be handled by TranslationAgent via events
              // This maintains the event-driven architecture where agents communicate via events

              // Broadcast caption to all users in session
              this.io.to(sessionId).emit('caption:update', {
                text: caption.text,
                language: caption.language,
                timestamp: caption.timestamp
              });

              // Auto-translate for users who have different language preferences
              if (this.userLanguagePreferences) {
                for (const [userId, preferredLanguage] of this.userLanguagePreferences.entries()) {
                  // If user prefers a different language than the caption language
                  if (preferredLanguage !== caption.language && 
                      ['hi', 'es', 'fr', 'en'].includes(preferredLanguage)) {
                    
                    console.log(`🔄 Auto-translating caption for user ${userId} from ${caption.language} to ${preferredLanguage}`);
                    
                    // Trigger translation through TranslationAgent
                    try {
                      const translationSessionId = `${sessionId}_${userId}`;
                      await this.translationAgent.processTranscription(translationSessionId, {
                        text: caption.text,
                        language: caption.language,
                        confidence: 0.9,
                        isFinal: true
                      });
                    } catch (translationError) {
                      console.error('Auto-translation error:', translationError);
                    }
                  }
                }
              }

            } catch (error) {
              console.error('Live caption generation error:', error);
            }
          }, 3000); // Every 3 seconds

          // Store interval reference for cleanup
          if (!this.liveCaptionIntervals) {
            this.liveCaptionIntervals = new Map();
          }
          this.liveCaptionIntervals.set(sessionId, { interval: captionInterval, stop: stopCaptions });

          socket.emit('live_captions_started', {
            sessionId,
            message: 'Live captions started',
            language
          });

        } catch (error) {
          console.error('Start live captions error:', error);
          socket.emit('error', { message: 'Failed to start live captions' });
        }
      });

      // Stop live captions
      socket.on('stop_live_captions', (data) => {
        try {
          const { sessionId } = data;
          
          if (this.liveCaptionIntervals && this.liveCaptionIntervals.has(sessionId)) {
            const { interval } = this.liveCaptionIntervals.get(sessionId);
            clearInterval(interval);
            this.liveCaptionIntervals.delete(sessionId);
            
            console.log(`🛑 Live captions stopped for session ${sessionId}`);
            
            socket.emit('live_captions_stopped', {
              sessionId,
              message: 'Live captions stopped'
            });
          }
        } catch (error) {
          console.error('Stop live captions error:', error);
        }
      });

      // Handle translation requests for captions
      socket.on('translate_caption', async (data) => {
        try {
          const { sessionId, captionText, sourceLanguage, targetLanguage, userId } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          console.log(`🔄 Translating caption: "${captionText}" from ${sourceLanguage} to ${targetLanguage}`);

          // Use TranslationAgent to translate the caption
          const translationSessionId = `${sessionId}_${socket.userId}`;
          
          // Switch to the requested target language if needed
          try {
            await this.translationAgent.switchLanguage(translationSessionId, targetLanguage);
          } catch (switchError) {
            console.warn(`Language switch failed, continuing with current language:`, switchError.message);
          }
          
          // Process translation through TranslationAgent
          await this.translationAgent.processTranscription(translationSessionId, {
            text: captionText,
            language: sourceLanguage,
            confidence: 0.9,
            isFinal: true
          });

          console.log(`✅ Caption translation initiated for session ${sessionId}`);

        } catch (error) {
          console.error('Translation error:', error);
          socket.emit('error', { message: 'Failed to translate caption' });
        }
      });

      // Handle language preference updates
      socket.on('update_language_preference', (data) => {
        try {
          const { sessionId, language } = data;
          
          // Verify user is in session
          if (!this.sessionUsers.has(sessionId) || 
              !this.sessionUsers.get(sessionId).has(socket.userId)) {
            socket.emit('error', { message: 'Not authorized for this session' });
            return;
          }

          console.log(`🌐 User ${socket.userId} updated language preference to ${language} for session ${sessionId}`);

          // Broadcast language preference to session (for potential shared translations)
          socket.to(sessionId).emit('user_language_updated', {
            userId: socket.userId,
            language,
            timestamp: new Date()
          });

          // Store user language preference (could be enhanced with a proper user session store)
          if (!this.userLanguagePreferences) {
            this.userLanguagePreferences = new Map();
          }
          this.userLanguagePreferences.set(socket.userId, language);

          socket.emit('language_preference_updated', {
            sessionId,
            language,
            message: 'Language preference updated'
          });

        } catch (error) {
          console.error('Language preference update error:', error);
          socket.emit('error', { message: 'Failed to update language preference' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const { sessionId } = data;
        socket.to(sessionId).emit('user_typing', {
          userId: socket.userId,
          userName: socket.userName
        });
      });

      socket.on('typing_stop', (data) => {
        const { sessionId } = data;
        socket.to(sessionId).emit('user_stopped_typing', {
          userId: socket.userId
        });
      });

      // Handle disconnect with graceful cleanup
      socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        
        if (socket.userId) {
          // Handle audio stream cleanup first (graceful disconnect)
          await this.audioChunkHandler.handleDisconnect(socket);
          
          // Clean up translation sessions for this user
          for (const [sessionId] of this.sessionUsers.entries()) {
            const translationSessionId = `${sessionId}_${socket.userId}`;
            try {
              await this.translationAgent.stopSession(translationSessionId);
              console.log(`🛑 Cleaned up translation session for user ${socket.userId} in ${sessionId}`);
            } catch (error) {
              console.warn(`⚠️ Failed to cleanup translation session for user ${socket.userId}:`, error.message);
            }
          }
          
          // Remove from connected users
          this.connectedUsers.delete(socket.userId);
          
          // Remove from all sessions
          for (const [sessionId, users] of this.sessionUsers.entries()) {
            if (users.has(socket.userId)) {
              users.delete(socket.userId);
              
              // Notify other users
              socket.to(sessionId).emit('user_left', {
                userId: socket.userId,
                userName: socket.userName,
                timestamp: new Date()
              });

              if (users.size === 0) {
                this.sessionUsers.delete(sessionId);
              }
            }
          }
        }
      });

      // Handle session control (host only)
      socket.on('start_session', async (data) => {
        try {
          const { sessionId } = data;
          
          // Verify user is host
          const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { hostId: true }
          });

          if (!session || session.hostId !== socket.userId) {
            socket.emit('error', { message: 'Only host can start session' });
            return;
          }

          // Update session status
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              isLive: true,
              status: 'LIVE'
            }
          });

          // Notify all users in session
          this.io.to(sessionId).emit('session_started', {
            sessionId,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Start session error:', error);
          socket.emit('error', { message: 'Failed to start session' });
        }
      });

      socket.on('end_session', async (data) => {
        try {
          const { sessionId, generateSummary = true } = data;
          
          // Verify user is host
          const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { hostId: true }
          });

          if (!session || session.hostId !== socket.userId) {
            socket.emit('error', { message: 'Only host can end session' });
            return;
          }

          // Stop live captions if running
          if (this.liveCaptionIntervals && this.liveCaptionIntervals.has(sessionId)) {
            const { interval } = this.liveCaptionIntervals.get(sessionId);
            clearInterval(interval);
            this.liveCaptionIntervals.delete(sessionId);
          }

          // Update session status
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              isLive: false,
              status: 'ENDED'
            }
          });

          let summaryData = null;

          // Generate AI summary if requested
          if (generateSummary) {
            try {
              console.log(`📝 Generating AI summary for session ${sessionId}`);
              
              // Get all captions for this session
              const captions = await prisma.caption.findMany({
                where: { sessionId },
                orderBy: { timestamp: 'asc' }
              });

              // Get all chat messages for this session
              const messages = await prisma.message.findMany({
                where: { sessionId },
                orderBy: { timestamp: 'asc' },
                include: {
                  user: {
                    select: { name: true, role: true }
                  }
                }
              });

              // Generate summary using summarization agent
              const summaryResult = await summarizationAgent.generateSummary(
                captions,
                messages,
                {
                  sessionId,
                  summaryType: 'comprehensive',
                  language: 'en',
                  includeChat: true,
                  maxLength: 800
                }
              );

              // Save summary to database
              await prisma.summary.create({
                data: {
                  sessionId,
                  content: summaryResult.summary.content
                }
              });

              summaryData = {
                content: summaryResult.summary.content,
                metadata: summaryResult.metadata
              };

              console.log(`✅ AI summary generated and saved for session ${sessionId}`);

            } catch (summaryError) {
              console.error('Summary generation error:', summaryError);
              // Continue with session ending even if summary fails
            }
          }

          // Notify all users in session
          this.io.to(sessionId).emit('session_ended', {
            sessionId,
            timestamp: new Date(),
            summary: summaryData
          });

          // Clean up session tracking
          this.sessionUsers.delete(sessionId);

          console.log(`🏁 Session ${sessionId} ended by host ${socket.userId}`);

        } catch (error) {
          console.error('End session error:', error);
          socket.emit('error', { message: 'Failed to end session' });
        }
      });
    });
  }

  /**
   * Shutdown SocketHandler and clean up resources
   */
  async shutdown() {
    console.log('🔄 Shutting down SocketHandler...');
    
    try {
      // Shutdown TranslationAgent
      if (this.translationAgent) {
        await this.translationAgent.shutdown();
      }
      
      // Clear live caption intervals
      if (this.liveCaptionIntervals) {
        for (const [sessionId, { interval }] of this.liveCaptionIntervals.entries()) {
          clearInterval(interval);
          console.log(`🛑 Cleared live caption interval for session ${sessionId}`);
        }
        this.liveCaptionIntervals.clear();
      }
      
      console.log('✅ SocketHandler shutdown complete');
      
    } catch (error) {
      console.error('❌ SocketHandler shutdown error:', error);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get users in session
   */
  getSessionUsers(sessionId) {
    return this.sessionUsers.get(sessionId) || new Set();
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Send message to all users in session
   */
  sendToSession(sessionId, event, data) {
    this.io.to(sessionId).emit(event, data);
  }
}

export default SocketHandler;

