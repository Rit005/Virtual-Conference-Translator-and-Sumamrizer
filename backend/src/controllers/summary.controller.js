import prisma from '../config/database.js';
import SummaryService from '../services/summary.service.js';

class SummaryController {
  /**
   * Generate summary for a session
   */
  static async generateSummary(req, res) {
    try {
      const { sessionId, type = 'full_summary' } = req.body;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      // Get session messages for summarization
      const messages = await prisma.message.findMany({
        where: { sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'asc' },
        take: 200 // Limit to last 200 messages for performance
      });

      // Generate summary using AI service
      const summaryResult = await SummaryService.generateSummary(
        messages,
        type,
        session.language
      );

      // Save summary to database
      const summary = await prisma.summary.create({
        data: {
          sessionId,
          content: JSON.stringify(summaryResult)
        }
      });

      res.json({
        success: true,
        message: 'Summary generated successfully',
        data: {
          summary: {
            ...summary,
            content: summaryResult
          }
        }
      });

    } catch (error) {
      console.error('Generate summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get summaries for a session
   */
  static async getSessionSummaries(req, res) {
    try {
      const { sessionId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      const skip = (page - 1) * limit;

      const summaries = await prisma.summary.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      });

      // Parse JSON content for each summary
      const parsedSummaries = summaries.map(summary => ({
        ...summary,
        content: JSON.parse(summary.content)
      }));

      const total = await prisma.summary.count({
        where: { sessionId }
      });

      res.json({
        success: true,
        data: {
          summaries: parsedSummaries,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get session summaries error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Generate real-time summary update
   */
  static async generateRealtimeUpdate(req, res) {
    try {
      const { sessionId } = req.params;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      // Get recent messages
      const recentMessages = await prisma.message.findMany({
        where: { sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 20 // Last 20 messages
      });

      // Generate real-time update
      const updateResult = await SummaryService.generateRealtimeUpdate(
        recentMessages,
        session.language
      );

      res.json({
        success: true,
        data: { update: updateResult }
      });

    } catch (error) {
      console.error('Generate realtime update error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Extract topics from session
   */
  static async extractTopics(req, res) {
    try {
      const { sessionId } = req.params;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      // Get session messages
      const messages = await prisma.message.findMany({
        where: { sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'asc' },
        take: 100
      });

      // Extract topics using AI service
      const topicsResult = await SummaryService.extractTopics(messages);

      res.json({
        success: true,
        data: { topics: topicsResult }
      });

    } catch (error) {
      console.error('Extract topics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Generate meeting minutes
   */
  static async generateMeetingMinutes(req, res) {
    try {
      const { sessionId } = req.params;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          },
          messages: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            },
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      // Generate meeting minutes using AI service
      const minutesResult = await SummaryService.generateMeetingMinutes(
        {
          id: session.id,
          title: session.title,
          description: session.description,
          host: session.host,
          participantCount: session.participants.length
        },
        session.messages
      );

      res.json({
        success: true,
        data: { minutes: minutesResult }
      });

    } catch (error) {
      console.error('Generate meeting minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Analyze sentiment of session
   */
  static async analyzeSentiment(req, res) {
    try {
      const { sessionId } = req.params;

      // Check if session exists and user has access
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          host: {
            select: { id: true, name: true }
          },
          participants: {
            where: { userId: req.user.id }
          }
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user has access to this session
      const hasAccess = session.host.id === req.user.id || 
                       session.participants.length > 0 ||
                       ['HOST', 'MODERATOR'].includes(req.user.role);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to session'
        });
      }

      // Get session messages
      const messages = await prisma.message.findMany({
        where: { sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      // Analyze sentiment using AI service
      const sentimentResult = await SummaryService.analyzeSentiment(messages);

      res.json({
        success: true,
        data: { sentiment: sentimentResult }
      });

    } catch (error) {
      console.error('Analyze sentiment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default SummaryController;

