import { useWebSocket as useWebSocketContext } from '../contexts/WebSocketContext.jsx';

// Re-export the useWebSocket hook for convenience
export const useWebSocket = useWebSocketContext;

// Additional WebSocket-specific hooks
export const useWebSocketConnection = () => {
  const { isConnected, connect, disconnect } = useWebSocketContext();
  return { isConnected, connect, disconnect };
};

export const useWebSocketCaptions = () => {
  const { captions, latestCaption, clearCaptions } = useWebSocketContext();
  return { captions, latestCaption, clearCaptions };
};

export const useWebSocketChat = () => {
  const { chatMessages, sendChatMessage, likeMessage, clearChatMessages } = useWebSocketContext();
  return { chatMessages, sendChatMessage, likeMessage, clearChatMessages };
};

export const useWebSocketSummary = () => {
  const { summary, requestSummary } = useWebSocketContext();
  return { summary, requestSummary };
};

export const useConferenceSession = () => {
  const { 
    currentSession, 
    selectedLanguage, 
    hasActiveSession, 
    isConnectedToSession,
    participantsCount,
    setSelectedLanguage 
  } = useWebSocketContext();
  
  return { 
    currentSession, 
    selectedLanguage, 
    hasActiveSession, 
    isConnectedToSession,
    participantsCount,
    setSelectedLanguage 
  };
};
