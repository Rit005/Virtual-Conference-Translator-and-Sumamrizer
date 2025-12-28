import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import websocketService from '../services/websocketService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { CONFERENCE_CONSTANTS } from '../utils/constants.js';

// Create the WebSocketContext
const WebSocketContext = createContext();

const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

const WebSocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [participantsCount, setParticipantsCount] = useState(1);
  const [pinnedQuestions, setPinnedQuestions] = useState([]);
  const [userRole, setUserRole] = useState('VIEWER');

  // Disconnect from WebSocket (declared first to avoid hoisting issue)
  const disconnect = useCallback(() => {
    try {
      websocketService.disconnect();
      setIsConnected(false);
      setCurrentSession(null);
      setCaptions([]);
      setChatMessages([]);
      setSummary(null);
      toast.success('Disconnected from conference');
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback((sessionId) => {
    if (!isAuthenticated || !user || !sessionId) {
      console.warn('Cannot connect: missing authentication or session ID');
      return;
    }

    try {
      // Disconnect any existing connection
      if (isConnected) {
        disconnect();
      }

      console.log(`Connecting to WebSocket for session: ${sessionId}`);
      websocketService.connect(sessionId, user.id);
      setCurrentSession(sessionId);
      
      toast.success('Connected to conference');
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      toast.error('Failed to connect to conference');
    }
  }, [isAuthenticated, user, isConnected, disconnect]);

  // Send chat message
  const sendChatMessage = useCallback((text) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.sendChatMessage(text, user.id, currentSession);
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send chat message:', error);
      toast.error('Failed to send message');
    }
  }, [currentSession, user]);

  // Start live captions
  const startLiveCaptions = useCallback((language = 'en') => {
    if (!currentSession) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.startLiveCaptions(currentSession, language);
      toast.success('Live captions started');
    } catch (error) {
      console.error('Failed to start live captions:', error);
      toast.error('Failed to start live captions');
    }
  }, [currentSession]);

  // Stop live captions
  const stopLiveCaptions = useCallback(() => {
    if (!currentSession) {
      return;
    }

    try {
      websocketService.stopLiveCaptions(currentSession);
      toast.success('Live captions stopped');
    } catch (error) {
      console.error('Failed to stop live captions:', error);
      toast.error('Failed to stop live captions');
    }
  }, [currentSession]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (currentSession) {
      websocketService.startTyping(currentSession);
    }
  }, [currentSession]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (currentSession) {
      websocketService.stopTyping(currentSession);
    }
  }, [currentSession]);

  // Start session (host only)
  const startSession = useCallback(() => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.startSession(currentSession);
      toast.success('Conference started');
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start conference');
    }
  }, [currentSession, user]);

  // End session (host only)
  const endSession = useCallback((generateSummary = true) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.endSession(currentSession, generateSummary);
      toast.success('Conference ended');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end conference');
    }
  }, [currentSession, user]);

  // Request summary
  const requestSummary = useCallback(() => {
    if (!currentSession) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.requestSummary(currentSession);
      toast.success('Summary requested');
    } catch (error) {
      console.error('Failed to request summary:', error);
      toast.error('Failed to request summary');
    }
  }, [currentSession]);

  // Translate a caption
  const translateCaption = useCallback((captionText, sourceLanguage, targetLanguage) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.translateCaption(
        currentSession, 
        captionText, 
        sourceLanguage, 
        targetLanguage, 
        user.id
      );
      console.log('Translation requested for caption');
    } catch (error) {
      console.error('Failed to translate caption:', error);
      toast.error('Failed to translate caption');
    }
  }, [currentSession, user]);

  // Update language preference
  const updateLanguagePreference = useCallback((language) => {
    if (!currentSession) {
      return;
    }

    try {
      websocketService.updateLanguagePreference(currentSession, language);
      setSelectedLanguage(language);
      toast.success(`Language preference updated to ${language}`);
    } catch (error) {
      console.error('Failed to update language preference:', error);
      toast.error('Failed to update language preference');
    }
  }, [currentSession]);

  // Handle connection status changes
  const handleConnectionStatus = useCallback((status) => {
    setIsConnected(status.connected);
  }, []);

  // Handle new captions with latency tracking and translation support
  const handleCaption = useCallback((caption) => {
    console.log('🎬 Processing new caption:', caption);
    
    setCaptions(prev => {
      // Create enhanced caption object
      const enhancedCaption = {
        id: caption.id || `caption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: caption.text || '',
        originalText: caption.originalText || caption.text || '',
        translatedText: caption.translatedText || null,
        sourceLanguage: caption.sourceLanguage || 'en',
        targetLanguage: caption.targetLanguage || selectedLanguage,
        speaker: caption.speaker || 'Speaker',
        timestamp: caption.timestamp || Date.now(),
        receivedAt: caption.receivedAt || Date.now(),
        latency: caption.latency || 0,
        latencyStatus: caption.latencyStatus || 'unknown',
        isTranslation: caption.isTranslation || false,
        confidence: caption.confidence || null,
        // Create a composite key for pairing original + translation
        pairId: caption.pairId || caption.originalText ? `pair_${Date.now()}` : null
      };

      // If this is a translation, try to pair it with original text
      if (enhancedCaption.isTranslation && enhancedCaption.originalText) {
        const newCaptions = [...prev];
        
        // Find matching original caption (same text and timestamp)
        const originalIndex = newCaptions.findIndex(c => 
          !c.isTranslation && 
          c.originalText === enhancedCaption.originalText &&
          Math.abs(c.timestamp - enhancedCaption.timestamp) < 5000 // within 5 seconds
        );
        
        if (originalIndex >= 0) {
          // Update the original caption with translation
          newCaptions[originalIndex] = {
            ...newCaptions[originalIndex],
            translatedText: enhancedCaption.text,
            targetLanguage: enhancedCaption.targetLanguage
          };
          
          return newCaptions.slice(-CONFERENCE_CONSTANTS.MAX_CAPTION_HISTORY);
        }
      }
      
      // For regular captions or unmatched translations, just add to the list
      const newCaptions = [...prev, enhancedCaption];
      return newCaptions.slice(-CONFERENCE_CONSTANTS.MAX_CAPTION_HISTORY);
    });
  }, [selectedLanguage]);

  // Handle chat messages
  const handleChatMessage = useCallback((message) => {
    setChatMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only the last MAX_CHAT_MESSAGES messages
      return newMessages.slice(-CONFERENCE_CONSTANTS.MAX_CHAT_MESSAGES);
    });
  }, []);

  // Handle summary updates
  const handleSummary = useCallback((summaryData) => {
    setSummary(summaryData);
  }, []);

  // Handle errors
  const handleError = useCallback((error) => {
    console.error('WebSocket error:', error);
    toast.error('Connection error occurred');
  }, []);

  // Handle translated captions
  const handleTranslatedCaption = useCallback((translation) => {
    console.log('🔄 Received translated caption:', translation);
    // Add translated caption to captions list with special marking
    const translatedCaption = {
      ...translation,
      isTranslation: true,
      id: `translation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setCaptions(prev => {
      const newCaptions = [...prev, translatedCaption];
      return newCaptions.slice(-CONFERENCE_CONSTANTS.MAX_CAPTION_HISTORY);
    });
  }, []);

  // Handle live captions started
  const handleLiveCaptionsStarted = useCallback((data) => {
    console.log('Live captions started:', data);
  }, []);

  // Handle live captions stopped
  const handleLiveCaptionsStopped = useCallback((data) => {
    console.log('Live captions stopped:', data);
  }, []);

  // Handle session events
  const handleSessionStarted = useCallback((data) => {
    console.log('Session started:', data);
    toast.success('Conference started!');
  }, []);

  const handleSessionEnded = useCallback((data) => {
    console.log('Session ended:', data);
    toast.success('Conference ended');
    if (data.summary) {
      setSummary(data.summary);
    }
  }, []);

  // Handle user events
  const handleUserJoined = useCallback((data) => {
    console.log('User joined:', data);
    toast(`${data.userName} joined the conference`);
  }, []);

  const handleUserLeft = useCallback((data) => {
    console.log('User left:', data);
    toast(`${data.userName} left the conference`);
  }, []);

  // Handle typing indicators
  const handleUserTyping = useCallback((data) => {
    console.log('User typing:', data);
    // Could add typing indicator state here
  }, []);

  const handleUserStoppedTyping = useCallback((data) => {
    console.log('User stopped typing:', data);
    // Could clear typing indicator state here
  }, []);

  // Handle participant count updates
  const handleParticipantCountUpdate = useCallback((data) => {
    console.log('Participant count updated:', data);
    if (data.sessionId === currentSession) {
      setParticipantsCount(data.count);
    }
  }, [currentSession]);

  // Handle message updates (for Q&A features)
  const handleMessageUpdated = useCallback((updatedMessage) => {
    setChatMessages(prev => 
      prev.map(msg => 
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      )
    );
  }, []);

  // Handle pinned questions
  const handlePinnedQuestions = useCallback((data) => {
    console.log('Received pinned questions:', data);
    if (data.sessionId === currentSession) {
      setPinnedQuestions(data.questions || []);
    }
  }, [currentSession]);

  // Handle user authentication updates
  const handleAuthenticated = useCallback((data) => {
    if (data.user) {
      setUserRole(data.user.role || 'VIEWER');
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Connection status
    websocketService.on('connectionStatus', handleConnectionStatus);
    
    // Live caption events - fix event name mapping
    websocketService.on('liveCaption', handleCaption);
    websocketService.on('caption:translated', handleTranslatedCaption);
    websocketService.on('liveCaptionsStarted', handleLiveCaptionsStarted);
    websocketService.on('liveCaptionsStopped', handleLiveCaptionsStopped);
    
    // Chat events
    websocketService.on('chatMessage', handleChatMessage);
    
    // Session lifecycle events
    websocketService.on('sessionStarted', handleSessionStarted);
    websocketService.on('sessionEnded', handleSessionEnded);
    
    // User events
    websocketService.on('userJoined', handleUserJoined);
    websocketService.on('userLeft', handleUserLeft);
    
    // Typing indicators
    websocketService.on('userTyping', handleUserTyping);
    websocketService.on('userStoppedTyping', handleUserStoppedTyping);
    
    // Summary events
    websocketService.on('summaryUpdate', handleSummary);
    
    // Participant count events
    websocketService.on('participant_count_update', handleParticipantCountUpdate);
    
    // Q&A events
    websocketService.on('message_updated', handleMessageUpdated);
    websocketService.on('pinned_questions', handlePinnedQuestions);
    websocketService.on('authenticated', handleAuthenticated);
    
    // Error events
    websocketService.on('error', handleError);

    // Cleanup
    return () => {
      websocketService.off('connectionStatus', handleConnectionStatus);
      websocketService.off('liveCaption', handleCaption);
      websocketService.off('caption:translated', handleTranslatedCaption);
      websocketService.off('liveCaptionsStarted', handleLiveCaptionsStarted);
      websocketService.off('liveCaptionsStopped', handleLiveCaptionsStopped);
      websocketService.off('chatMessage', handleChatMessage);
      websocketService.off('sessionStarted', handleSessionStarted);
      websocketService.off('sessionEnded', handleSessionEnded);
      websocketService.off('userJoined', handleUserJoined);
      websocketService.off('userLeft', handleUserLeft);
      websocketService.off('userTyping', handleUserTyping);
      websocketService.off('userStoppedTyping', handleUserStoppedTyping);
      websocketService.off('summaryUpdate', handleSummary);
      websocketService.off('participant_count_update', handleParticipantCountUpdate);
      websocketService.off('message_updated', handleMessageUpdated);
      websocketService.off('pinned_questions', handlePinnedQuestions);
      websocketService.off('authenticated', handleAuthenticated);
      websocketService.off('error', handleError);
    };
  }, [
    handleConnectionStatus,
    handleCaption,
    handleLiveCaptionsStarted,
    handleLiveCaptionsStopped,
    handleChatMessage,
    handleSessionStarted,
    handleSessionEnded,
    handleUserJoined,
    handleUserLeft,
    handleUserTyping,
    handleUserStoppedTyping,
    handleSummary,
    handleParticipantCountUpdate,
    handleMessageUpdated,
    handlePinnedQuestions,
    handleAuthenticated,
    handleError,
    currentSession
  ]);

  // Clear captions
  const clearCaptions = useCallback(() => {
    setCaptions([]);
  }, []);

  // Clear chat messages
  const clearChatMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Like a chat message
  const likeMessage = useCallback((messageId) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.likeMessage(messageId, currentSession);
    } catch (error) {
      console.error('Failed to like message:', error);
      toast.error('Failed to like message');
    }
  }, [currentSession, user]);

  // Mark message as question
  const markMessageAsQuestion = useCallback((messageId, questionCategory = null) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.markAsQuestion(messageId, questionCategory, currentSession);
      toast.success('Message marked as question');
    } catch (error) {
      console.error('Failed to mark message as question:', error);
      toast.error('Failed to mark message as question');
    }
  }, [currentSession, user]);

  // Unmark message as question
  const unmarkMessageAsQuestion = useCallback((messageId) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.unmarkAsQuestion(messageId, currentSession);
      toast.success('Question unmarked');
    } catch (error) {
      console.error('Failed to unmark message as question:', error);
      toast.error('Failed to unmark question');
    }
  }, [currentSession, user]);

  // Pin question (moderator only)
  const pinMessage = useCallback((messageId) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.pinQuestion(messageId, currentSession);
      toast.success('Question pinned');
    } catch (error) {
      console.error('Failed to pin question:', error);
      toast.error('Failed to pin question');
    }
  }, [currentSession, user]);

  // Unpin question (moderator only)
  const unpinMessage = useCallback((messageId) => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.unpinQuestion(messageId, currentSession);
      toast.success('Question unpinned');
    } catch (error) {
      console.error('Failed to unpin question:', error);
      toast.error('Failed to unpin question');
    }
  }, [currentSession, user]);

  // Get pinned questions
  const getPinnedQuestions = useCallback(() => {
    if (!currentSession || !user) {
      toast.error('Not connected to conference');
      return;
    }

    try {
      websocketService.getPinnedQuestions(currentSession);
    } catch (error) {
      console.error('Failed to get pinned questions:', error);
      toast.error('Failed to get pinned questions');
    }
  }, [currentSession, user]);

  const value = {
    // State
    isConnected,
    captions,
    chatMessages,
    summary,
    currentSession,
    selectedLanguage,
    pinnedQuestions,
    userRole,
    
    // Actions
    connect,
    disconnect,
    sendChatMessage,
    startLiveCaptions,
    stopLiveCaptions,
    startTyping,
    stopTyping,
    startSession,
    endSession,
    requestSummary,
    translateCaption,
    updateLanguagePreference,
    clearCaptions,
    clearChatMessages,
    likeMessage,
    markMessageAsQuestion,
    unmarkMessageAsQuestion,
    pinMessage,
    unpinMessage,
    getPinnedQuestions,
    setSelectedLanguage,
    
    // Computed values
    hasActiveSession: !!currentSession,
    isConnectedToSession: isConnected && !!currentSession,
    latestCaption: captions.length > 0 ? captions[captions.length - 1] : null,
    participantsCount
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Export both provider and hook
// eslint-disable-next-line react-refresh/only-export-components
export { WebSocketProvider, useWebSocket };
