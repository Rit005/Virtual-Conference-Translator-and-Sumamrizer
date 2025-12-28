/**
 * Conference Routes
 * 
 * Routes for conference session management
 */

import express from 'express';
import ConferenceController from '../controllers/conference.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all conference routes
router.use(authenticate);

// Create a new conference session
router.post('/create', ConferenceController.createSession);

// Join an existing conference session
router.post('/join/:sessionId', ConferenceController.joinSession);

// Leave a conference session
router.post('/leave/:sessionId', ConferenceController.leaveSession);

// Get session details
router.get('/session/:sessionId', ConferenceController.getSession);

// Get user's hosted sessions
router.get('/my-sessions', ConferenceController.getUserSessions);

export default router;
