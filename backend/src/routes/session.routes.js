import express from 'express';
import SessionController from '../controllers/session.controller.js';
import { validate, sessionSchemas } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { checkSessionHost, checkSessionParticipant, isHost } from '../middleware/role.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticate);

// Create new session (HOST or MODERATOR only)
router.post('/create', 
  validate(sessionSchemas.create), 
  isHost, 
  SessionController.createSession
);

// Get user's sessions
router.get('/my-sessions', SessionController.getUserSessions);

// Get active sessions (public)
router.get('/active', SessionController.getActiveSessions);

// Session-specific routes (require session access)
router.get('/:sessionId', 
  checkSessionParticipant, 
  SessionController.getSession
);

router.post('/:sessionId/join', 
  checkSessionParticipant, 
  SessionController.joinSession
);

router.post('/:sessionId/leave', 
  checkSessionParticipant, 
  SessionController.leaveSession
);

// Host-only routes
router.put('/:sessionId', 
  checkSessionHost, 
  validate(sessionSchemas.update), 
  SessionController.updateSession
);

router.delete('/:sessionId', 
  checkSessionHost, 
  SessionController.deleteSession
);

export { router };

