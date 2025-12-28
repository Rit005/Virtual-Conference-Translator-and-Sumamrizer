import prisma from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class SessionController {
  /**
   * Create a new conference session
   */
  static async createSession(req, res) {
    try {
      const { title, description, language = 'en', maxUsers = 100 } = req.body;
      const hostId = req.user.id;

      // Check if user can create sessions (HOST role or above)
      if (!['HOST', 'MODERATOR'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to create sessions'
        });
      }

      const session = await prisma.session.create({
        data: {
          title,
          description,
          language,
          maxUsers,
          hostId,
          status: 'CREATED',
          isLive: false
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true,
              captions: true,
              summaries: true
            }
          }
        }
      });

      // Automatically add host as participant
      await prisma.sessionParticipant.create({
        data: {
          sessionId: session.id,
          userId: hostId
        }
      });

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: { session }
      });

    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get session by ID
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
              email: true,
              role: true,
              avatar: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  avatar: true
                }
              }
            }
          },
          messages: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            },
            orderBy: { timestamp: 'desc' },
            take: 50 // Latest 50 messages
          },
          captions: {
            orderBy: { timestamp: 'desc' },
            take: 20 // Latest 20 captions
          },
          summaries: {
            orderBy: { createdAt: 'desc' },
            take: 5 // Latest 5 summaries
          },
          _count: {
            select: {
              participants: true,
              messages: true,
              captions: true,
              summaries: true
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

      res.json({
        success: true,
        data: { session }
      });

    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Join a session
   */
  static async joinSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Check if session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          title: true,
          maxUsers: true,
          _count: {
            select: { participants: true }
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
      if (session._count.participants >= session.maxUsers) {
        return res.status(400).json({
          success: false,
          message: 'Session is at maximum capacity'
        });
      }

      // Check if user is already a participant
      const existingParticipant = await prisma.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId
          }
        }
      });

      if (existingParticipant) {
        return res.status(400).json({
          success: false,
          message: 'Already joined this session'
        });
      }

      // Add user as participant
      await prisma.sessionParticipant.create({
        data: {
          sessionId,
          userId
        }
      });

      // Get updated session info
      const updatedSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  avatar: true
                }
              }
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Joined session successfully',
        data: { session: updatedSession }
      });

    } catch (error) {
      console.error('Join session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Leave a session
   */
  static async leaveSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Check if user is the host
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hostId: true }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.hostId === userId) {
        return res.status(400).json({
          success: false,
          message: 'Host cannot leave their own session'
        });
      }

      // Remove user from participants
      await prisma.sessionParticipant.delete({
        where: {
          sessionId_userId: {
            sessionId,
            userId
          }
        }
      });

      res.json({
        success: true,
        message: 'Left session successfully'
      });

    } catch (error) {
      console.error('Leave session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update session (host only)
   */
  static async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { title, description, isLive, language, maxUsers } = req.body;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hostId: true }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.hostId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only session host can update session'
        });
      }

      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(isLive !== undefined && { 
            isLive,
            status: isLive ? 'LIVE' : 'ENDED'
          }),
          ...(language && { language }),
          ...(maxUsers && { maxUsers })
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true,
              captions: true,
              summaries: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: { session: updatedSession }
      });

    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get user's sessions
   */
  static async getUserSessions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const sessions = await prisma.session.findMany({
        where: {
          OR: [
            { hostId: userId },
            { participants: { some: { userId } } }
          ]
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true,
              captions: true,
              summaries: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      });

      const total = await prisma.session.count({
        where: {
          OR: [
            { hostId: userId },
            { participants: { some: { userId } } }
          ]
        }
      });

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get all active sessions
   */
  static async getActiveSessions(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const sessions = await prisma.session.findMany({
        where: {
          isLive: true
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          _count: {
            select: {
              participants: true,
              messages: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      });

      const total = await prisma.session.count({
        where: { isLive: true }
      });

      res.json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Delete session (host only)
   */
  static async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hostId: true }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.hostId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only session host can delete session'
        });
      }

      await prisma.session.delete({
        where: { id: sessionId }
      });

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });

    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default SessionController;

