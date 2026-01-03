import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useRef
} from 'react';
import websocketService from '../services/websocketService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { CONFERENCE_CONSTANTS } from '../utils/constants.js';

/* ------------------------------------------------------------------ */
/* CONTEXT SETUP                                                       */
/* ------------------------------------------------------------------ */

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return ctx;
};

/* ------------------------------------------------------------------ */
/* PROVIDER                                                           */
/* ------------------------------------------------------------------ */

const WebSocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [participantsCount, setParticipantsCount] = useState(1);
  const [pinnedQuestions, setPinnedQuestions] = useState([]);
  const [userRole, setUserRole] = useState('VIEWER');

  const isMountedRef = useRef(true);

  /* ------------------------------------------------------------------ */
  /* CONNECTION HANDLING                                                */
  /* ------------------------------------------------------------------ */

  const disconnect = useCallback(() => {
    try {
      websocketService.disconnect();
    } catch (e) {
      console.error('Disconnect error:', e);
    } finally {
      setIsConnected(false);
      setCurrentSession(null);
      setCaptions([]);
      setChatMessages([]);
      setSummary(null);
    }
  }, []);

  const connect = useCallback(
    (sessionId) => {
      if (!isAuthenticated || !user || !sessionId) return;

      try {
        websocketService.connect(sessionId, user.id);
        setCurrentSession(sessionId);
      } catch (err) {
        console.error('WebSocket connect failed:', err);
        toast.error('Failed to connect to conference');
      }
    },
    [isAuthenticated, user]
  );

  /* ------------------------------------------------------------------ */
  /* ACTIONS                                                            */
  /* ------------------------------------------------------------------ */

  const sendChatMessage = useCallback(
    (text) => {
      if (!currentSession || !user) return;
      websocketService.sendChatMessage(text, user.id, currentSession);
    },
    [currentSession, user]
  );

  const startLiveCaptions = useCallback(
    (language = 'en') => {
      if (!currentSession) return;
      websocketService.startLiveCaptions(currentSession, language);
    },
    [currentSession]
  );

  const stopLiveCaptions = useCallback(() => {
    if (!currentSession) return;
    websocketService.stopLiveCaptions(currentSession);
  }, [currentSession]);

  const startTyping = useCallback(() => {
    if (currentSession) websocketService.startTyping(currentSession);
  }, [currentSession]);

  const stopTyping = useCallback(() => {
    if (currentSession) websocketService.stopTyping(currentSession);
  }, [currentSession]);

  const startSession = useCallback(() => {
    if (currentSession) websocketService.startSession(currentSession);
  }, [currentSession]);

  const endSession = useCallback(
    (generateSummary = true) => {
      if (currentSession) {
        websocketService.endSession(currentSession, generateSummary);
      }
    },
    [currentSession]
  );

  const requestSummary = useCallback(() => {
    if (currentSession) websocketService.requestSummary(currentSession);
  }, [currentSession]);

  const updateLanguagePreference = useCallback(
    (language) => {
      if (!currentSession) return;
      websocketService.updateLanguagePreference(currentSession, language);
      setSelectedLanguage(language);
    },
    [currentSession]
  );

  /* ------------------------------------------------------------------ */
  /* EVENT HANDLERS                                                     */
  /* ------------------------------------------------------------------ */

  const handleConnectionStatus = useCallback((status) => {
    if (!isMountedRef.current) return;
    setIsConnected(Boolean(status?.connected));
  }, []);

  const handleCaption = useCallback(
    (caption) => {
      setCaptions((prev) => {
        const next = [
          ...prev,
          {
            id: caption.id || crypto.randomUUID(),
            text: caption.text || '',
            translatedText: caption.translatedText || null,
            sourceLanguage: caption.sourceLanguage || 'en',
            targetLanguage: caption.targetLanguage || selectedLanguage,
            speaker: caption.speaker || 'Speaker',
            timestamp: caption.timestamp || Date.now(),
            isTranslation: false
          }
        ];
        return next.slice(-CONFERENCE_CONSTANTS.MAX_CAPTION_HISTORY);
      });
    },
    [selectedLanguage]
  );

  const handleTranslatedCaption = useCallback((data) => {
    setCaptions((prev) => {
      const next = [
        ...prev,
        {
          ...data,
          id: crypto.randomUUID(),
          isTranslation: true
        }
      ];
      return next.slice(-CONFERENCE_CONSTANTS.MAX_CAPTION_HISTORY);
    });
  }, []);

  const handleChatMessage = useCallback((msg) => {
    setChatMessages((prev) =>
      [...prev, msg].slice(-CONFERENCE_CONSTANTS.MAX_CHAT_MESSAGES)
    );
  }, []);

  const handleSummary = useCallback((data) => {
    setSummary(data);
  }, []);

  const handleSessionStarted = useCallback(() => {
    toast.success('Conference started');
  }, []);

  const handleSessionEnded = useCallback((data) => {
    toast.success('Conference ended');
    if (data?.summary) setSummary(data.summary);
  }, []);

  const handleParticipantCountUpdate = useCallback(
    (data) => {
      if (data.sessionId === currentSession) {
        setParticipantsCount(data.count);
      }
    },
    [currentSession]
  );

  const handlePinnedQuestions = useCallback(
    (data) => {
      if (data.sessionId === currentSession) {
        setPinnedQuestions(data.questions || []);
      }
    },
    [currentSession]
  );

  const handleAuthenticated = useCallback((data) => {
    if (data?.user?.role) setUserRole(data.user.role);
  }, []);

  const handleError = useCallback((err) => {
    console.error('WebSocket error:', err);
  }, []);

  /* ------------------------------------------------------------------ */
  /* LISTENER REGISTRATION                                              */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    isMountedRef.current = true;

    websocketService.on('connectionStatus', handleConnectionStatus);
    websocketService.on('liveCaption', handleCaption);
    websocketService.on('caption:translated', handleTranslatedCaption);
    websocketService.on('chatMessage', handleChatMessage);
    websocketService.on('summaryUpdate', handleSummary);
    websocketService.on('sessionStarted', handleSessionStarted);
    websocketService.on('sessionEnded', handleSessionEnded);
    websocketService.on('participant_count_update', handleParticipantCountUpdate);
    websocketService.on('pinned_questions', handlePinnedQuestions);
    websocketService.on('authenticated', handleAuthenticated);
    websocketService.on('error', handleError);

    return () => {
      isMountedRef.current = false;

      websocketService.off('connectionStatus', handleConnectionStatus);
      websocketService.off('liveCaption', handleCaption);
      websocketService.off('caption:translated', handleTranslatedCaption);
      websocketService.off('chatMessage', handleChatMessage);
      websocketService.off('summaryUpdate', handleSummary);
      websocketService.off('sessionStarted', handleSessionStarted);
      websocketService.off('sessionEnded', handleSessionEnded);
      websocketService.off('participant_count_update', handleParticipantCountUpdate);
      websocketService.off('pinned_questions', handlePinnedQuestions);
      websocketService.off('authenticated', handleAuthenticated);
      websocketService.off('error', handleError);
    };
  }, [
    handleConnectionStatus,
    handleCaption,
    handleTranslatedCaption,
    handleChatMessage,
    handleSummary,
    handleSessionStarted,
    handleSessionEnded,
    handleParticipantCountUpdate,
    handlePinnedQuestions,
    handleAuthenticated,
    handleError
  ]);

  /* ------------------------------------------------------------------ */
  /* CONTEXT VALUE                                                      */
  /* ------------------------------------------------------------------ */

  const value = {
    isConnected,
    currentSession,
    captions,
    chatMessages,
    summary,
    selectedLanguage,
    participantsCount,
    pinnedQuestions,
    userRole,

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
    updateLanguagePreference,
    setSelectedLanguage,

    hasActiveSession: Boolean(currentSession),
    isConnectedToSession: isConnected && Boolean(currentSession),
    latestCaption: captions.at(-1) || null
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export { WebSocketProvider };