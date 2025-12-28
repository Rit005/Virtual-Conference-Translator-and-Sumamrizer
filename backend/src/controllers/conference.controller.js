/**
 * Conference Controller
 * 
 * Handles conference session management including creation, joining, and lifecycle operations.
 */

import { prisma } from '../prismaClient.js';

class ConferenceController {
  /**
   * Create a new conference session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createSession(req, res) {
    try {
      const { title, description, language = 'en', maxUsers = 100 } = req.body;
      const userId = req.user.id;

      // Create new session in database
      const session = await prisma.session.create({
        data: {
          title: title || `Conference ${new Date().toLocaleDateString()}`,
          description: description || '',
          hostId: userId,
          language,
          maxUsers,
          status: 'CREATED',
          isLive: false
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Add host as participant
      await prisma.sessionParticipant.create({
        data: {
          sessionId: session.id,
          userId: userId
        }
      });

      res.status(201).json({
        success: true,
        message: 'Conference session created successfully',
        data: {
          session: {
            id: session.id,
            title: session.title,
            description: session.description,
            host: session.host,
            language: session.language,
            maxUsers: session.maxUsers,
            status: session.status,
            isLive: session.isLive,
            createdAt: session.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create conference session',
        error: error.message
      });
    }
  }

  /**
   * Join an existing conference session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async joinSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Check if session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if session is at capacity
      if (session.participants.length >= session.maxUsers) {
        return res.status(400).json({
          success: false,
          message: 'Session is at maximum capacity'
        });
      }

      // Check if user is already a participant
      const existingParticipant = session.participants.find(
        p => p.userId === userId
      );

      if (!existingParticipant) {
        // Add user as participant
        await prisma.sessionParticipant.create({
          data: {
            sessionId: sessionId,
            userId: userId
          }
        });
      }

      // Get updated session data
      const updatedSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Successfully joined conference session',
        data: {
          session: {
            id: updatedSession.id,
            title: updatedSession.title,
            description: updatedSession.description,
            host: updatedSession.host,
            language: updatedSession.language,
            maxUsers: updatedSession.maxUsers,
            status: updatedSession.status,
            isLive: updatedSession.isLive,
            participantsCount: updatedSession.participants.length,
            createdAt: updatedSession.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Join session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join conference session',
        error: error.message
      });
    }
  }

  /**
   * Leave a conference session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async leaveSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Remove user from session participants
      await prisma.sessionParticipant.deleteMany({
        where: {
          sessionId: sessionId,
          userId: userId
        }
      });

      res.json({
        success: true,
        message: 'Successfully left conference session'
      });

    } catch (error) {
      console.error('Leave session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to leave conference session',
        error: error.message
      });
    }
  }

  /**
   * Get session details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          messages: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              timestamp: 'desc'
            },
            take: 50
          },
          captions: {
            orderBy: {
              timestamp: 'desc'
            },
            take: 20
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            title: session.title,
            description: session.description,
            host: session.host,
            language: session.language,
            maxUsers: session.maxUsers,
            status: session.status,
            isLive: session.isLive,
            participantsCount: session.participants.length,
            participants: session.participants.map(p => p.user),
            recentMessages: session.messages,
            recentCaptions: session.captions,
            createdAt: session.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session details',
        error: error.message
      });
    }
  }

  /**
   * Get user's hosted sessions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserSessions(req, res) {
    try {
      const userId = req.user.id;

      const sessions = await prisma.session.findMany({
        where: {
          hostId: userId
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            title: session.title,
            description: session.description,
            host: session.host,
            language: session.language,
            maxUsers: session.maxUsers,
            status: session.status,
            isLive: session.isLive,
            participantsCount: session.participants.length,
            createdAt: session.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user sessions',
        error: error.message
      });
    }
  }
}

export default ConferenceController;
