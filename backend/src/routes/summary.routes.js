import express from 'express';
import SummaryController from '../controllers/summary.controller.js';
import { validate, summarySchemas } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { checkSessionParticipant } from '../middleware/role.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticate);

// Generate summary for a session
router.post('/generate', 
  validate(summarySchemas.generate), 
  SummaryController.generateSummary
);

// Session-specific summary routes
router.get('/session/:sessionId', 
  checkSessionParticipant, 
  SummaryController.getSessionSummaries
);

router.get('/session/:sessionId/realtime', 
  checkSessionParticipant, 
  SummaryController.generateRealtimeUpdate
);

router.get('/session/:sessionId/topics', 
  checkSessionParticipant, 
  SummaryController.extractTopics
);

router.get('/session/:sessionId/minutes', 
  checkSessionParticipant, 
  SummaryController.generateMeetingMinutes
);

router.get('/session/:sessionId/sentiment', 
  checkSessionParticipant, 
  SummaryController.analyzeSentiment
);

export { router };

