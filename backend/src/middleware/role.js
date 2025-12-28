import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions"
      });
    }
    next();
  };
};

// Check if user is HOST
export const isHost = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (req.user.role !== 'HOST' && req.user.role !== 'MODERATOR') {
    return res.status(403).json({
      success: false,
      message: "Access denied. HOST or MODERATOR role required"
    });
  }
  next();
};

// Check if user is session host
export const checkSessionHost = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const sessionId = req.params.sessionId;
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    if (session.hostId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only session host can perform this action"
      });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error('Check session host error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Check if user is session participant
export const checkSessionParticipant = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const sessionId = req.params.sessionId;
    
    // First check if session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // Check if user is the host
    if (session.hostId === req.user.id) {
      req.session = session;
      return next();
    }

    // Check if user is a participant
    const participant = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: req.user.id
        }
      }
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a participant of this session"
      });
    }

    req.session = session;
    req.participant = participant;
    next();
  } catch (error) {
    console.error('Check session participant error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
