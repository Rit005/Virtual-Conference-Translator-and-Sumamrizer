import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme.js';
import { useWebSocket } from '../../contexts/WebSocketContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useAudioStreaming } from '../../hooks/useAudioStreaming.js';
import ConferenceService from '../../services/conferenceService.js';
import LiveCaptions from './LiveCaptions.jsx';
import ChatPanel from './ChatPanel.jsx';
import SummaryPanel from './SummaryPanel.jsx';
import { CONFERENCE_CONSTANTS } from '../../utils/constants.js';
import { 
  ChatBubbleLeftRightIcon, 
  SpeakerWaveIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowRightOnRectangleIcon,
  PlayIcon,
  StopIcon,
  LanguageIcon,
  MicrophoneIcon,
  NoSymbolIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ConferenceDashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { 
    isConnected, 
    hasActiveSession,
    participantsCount,
    currentSession,
    selectedLanguage,
    updateLanguagePreference,
    connect,
    disconnect,
    startLiveCaptions,
    stopLiveCaptions,
    startSession,
    endSession,
    sendChatMessage,
    startTyping,
    stopTyping,
    translateCaption
  } = useWebSocket();

  // Audio streaming hook
  const {
    isStreaming,
    isRecording,
    hasPermission,
    isRequestingPermission,
    audioLevel,
    error: audioError,
    recordingTime,
    isSupported: audioSupported,
    startStreaming,
    stopStreaming,
    requestPermission,
    cleanup,
    formatRecordingTime,
    canStream,
    isReady
  } = useAudioStreaming({
    sessionId: currentSession,
    language: selectedLanguage,
    onChunkSent: (chunkInfo) => {
      console.log('📤 Audio chunk sent:', chunkInfo);
    },
    onError: (error) => {
      console.error('Audio streaming error:', error);
      toast.error(`Audio error: ${error}`);
    },
    onAudioLevel: (level) => {
      // Audio level can be used for visualization
      // console.log('Audio level:', level);
    }
  });
  
  const [activeTab, setActiveTab] = useState('captions');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Check if current user is host (for demo, assume first user to join is host)
  useEffect(() => {
    if (hasActiveSession && currentSession) {
      // In a real app, you'd get this from user.role or session.hostId
      setIsHost(true); // For demo purposes
    }
  }, [hasActiveSession, currentSession]);

  // Handle join session
  const handleJoinSession = () => {
    if (sessionIdInput.trim()) {
      connect(sessionIdInput.trim());
      setSessionIdInput('');
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    // Stop audio streaming if active
    if (isStreaming) {
      stopStreaming();
    }
    
    // Clean up audio resources
    cleanup();
    
    if (isSessionStarted && isHost) {
      endSession(true); // Generate summary when ending
    } else {
      disconnect();
    }
  };

  // Generate new session ID
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle start new session
  const handleStartNewSession = async () => {
    try {
      // Create session in database first
      const sessionData = await ConferenceService.createSession({
        title: `Conference ${new Date().toLocaleDateString()}`,
        description: 'Real-time conference with translation and summarization',
        language: selectedLanguage,
        maxUsers: 100
      });
      
      // Connect to WebSocket with the returned session ID
      if (sessionData.data?.session?.id) {
        connect(sessionData.data.session.id);
        toast.success('Conference created successfully!');
      } else {
        throw new Error('Invalid session data received');
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create conference');
      
      // Fallback: create session directly via WebSocket
      const newSessionId = generateSessionId();
      connect(newSessionId);
      toast.success('Connected to new conference session');
    }
  };

  // Handle start conference
  const handleStartConference = async () => {
    if (isHost && hasActiveSession) {
      startSession();
      startLiveCaptions(selectedLanguage);
      setIsSessionStarted(true);
      
      // Start audio streaming
      if (audioSupported && canStream) {
        try {
          const success = await startStreaming();
          if (success) {
            console.log('🎤 Audio streaming started for conference');
          } else {
            console.warn('⚠️ Failed to start audio streaming');
          }
        } catch (error) {
          console.error('❌ Error starting audio streaming:', error);
          toast.error('Failed to start audio streaming');
        }
      } else {
        console.warn('⚠️ Audio streaming not supported or not ready');
        toast.error('Audio streaming not supported or not ready');
      }
    }
  };

  // Handle end conference
  const handleEndConference = () => {
    if (isHost && hasActiveSession) {
      // Stop audio streaming first
      if (isStreaming) {
        stopStreaming();
      }
      
      endSession(true); // Generate summary
      setIsSessionStarted(false);
    }
  };

  // Handle microphone permission request
  const handleRequestPermission = async () => {
    try {
      await requestPermission();
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      toast.error('Failed to request microphone permission');
    }
  };

  // Handle chat message send
  const handleSendMessage = () => {
    if (chatInput.trim() && hasActiveSession) {
      sendChatMessage(chatInput.trim());
      setChatInput('');
      setIsTyping(false);
      stopTyping();
    }
  };

  // Handle typing start
  const handleTypingStart = () => {
    if (!isTyping && hasActiveSession) {
      setIsTyping(true);
      startTyping();
    }
  };

  // Handle typing stop
  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
  };

  const tabs = [
    {
      id: 'captions',
      name: t('liveCaptions'),
      icon: SpeakerWaveIcon,
      component: LiveCaptions
    },
    {
      id: 'chat',
      name: t('chatQA'),
      icon: ChatBubbleLeftRightIcon,
      component: ChatPanel
    },
    {
      id: 'summary',
      name: t('summary'),
      icon: DocumentTextIcon,
      component: SummaryPanel
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || LiveCaptions;

  return (
    <div className={`
      min-h-screen
      ${isDark 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
      }
    `}>
      <div className="container mx-auto px-4 py-6">
        {/* Conference Controls */}
        {!hasActiveSession ? (
          <div className={`
            max-w-2xl mx-auto p-6 rounded-lg border
            ${isDark 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
            }
            shadow-lg
          `}>
            <div className="text-center mb-6">
              <h1 className={`
                text-3xl font-bold mb-2
                ${isDark ? 'text-white' : 'text-gray-900'}
              `}>
                {t('joinConference')}
              </h1>
              <p className={`
                text-sm
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                Start a new conference or join an existing session
              </p>
            </div>

            {/* Start New Session */}
            <div className="space-y-4">
              <button
                onClick={handleStartNewSession}
                className={`
                  w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border transition-colors
                  ${isDark 
                    ? 'border-blue-600 bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'border-blue-600 bg-blue-600 hover:bg-blue-700 text-white'
                  }
                  font-medium
                `}
              >
                <PlusIcon className="w-5 h-5" />
                <span>{t('startConference')}</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className={`
                    w-full border-t
                    ${isDark ? 'border-gray-600' : 'border-gray-300'}
                  `} />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className={`
                    px-2
                    ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}
                  `}>
                    Or join existing session
                  </span>
                </div>
              </div>

              {/* Join Existing Session */}
              <div className="space-y-3">
                <input
                  type="text"
                  value={sessionIdInput}
                  onChange={(e) => setSessionIdInput(e.target.value)}
                  placeholder={t('sessionId')}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${isDark 
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' 
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    }
                  `}
                />
                <button
                  onClick={handleJoinSession}
                  disabled={!sessionIdInput.trim()}
                  className={`
                    w-full py-2 px-4 rounded-lg font-medium transition-colors
                    ${!sessionIdInput.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isDark 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }
                  `}
                >
                  {t('joinConference')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Conference Header */}
            <div className={`
              p-4 rounded-lg border
              ${isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
              }
            `}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`
                    flex items-center space-x-2
                    ${isConnected ? 'text-green-500' : 'text-red-500'}
                  `}>
                    <div className={`
                      w-3 h-3 rounded-full
                      ${isConnected ? 'bg-green-500' : 'bg-red-500'}
                    `} />
                    <span className="font-medium">
                      {isConnected ? t('connected') : t('disconnected')}
                    </span>
                  </div>
                  
                  <div className={`
                    text-sm
                    ${isDark ? 'text-gray-400' : 'text-gray-600'}
                  `}>
                    <span>{t('participants')}: {participantsCount}</span>
                  </div>

                  {currentSession && (
                    <div className={`
                      text-xs px-2 py-1 rounded
                      ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}
                    `}>
                      {currentSession}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  {/* Audio Streaming Controls */}
                  {audioSupported && hasActiveSession && (
                    <div className="flex items-center space-x-3">
                      {/* Audio Level Indicator */}
                      {hasPermission && isReady && (
                        <div className="flex items-center space-x-2">
                          <SignalIcon className="w-4 h-4" />
                          <div className={`
                            w-16 h-2 rounded-full
                            ${isDark ? 'bg-gray-600' : 'bg-gray-300'}
                          `}>
                            <div 
                              className={`
                                h-full rounded-full transition-all duration-100
                                ${isStreaming 
                                  ? audioLevel > 0.1 
                                    ? 'bg-green-500' 
                                    : 'bg-gray-400'
                                  : 'bg-gray-400'
                                }
                              `}
                              style={{ 
                                width: `${Math.min(audioLevel * 100, 100)}%` 
                              }}
                            />
                          </div>
                          {isRecording && (
                            <span className={`
                              text-xs
                              ${isDark ? 'text-gray-400' : 'text-gray-600'}
                            `}>
                              {formatRecordingTime(recordingTime)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Microphone Permission Button */}
                      {!hasPermission && !isRequestingPermission && (
                        <button
                          onClick={handleRequestPermission}
                          className={`
                            flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors
                            ${isDark 
                              ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                              : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }
                          `}
                        >
                          <MicrophoneIcon className="w-4 h-4" />
                          <span>Enable Mic</span>
                        </button>
                      )}

                      {/* Permission Requesting Indicator */}
                      {isRequestingPermission && (
                        <div className={`
                          flex items-center space-x-2 px-3 py-1 rounded-md text-sm
                          ${isDark 
                            ? 'bg-yellow-600 text-white' 
                            : 'bg-yellow-600 text-white'
                          }
                        `}>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Requesting mic...</span>
                        </div>
                      )}

                      {/* Audio Error Display */}
                      {audioError && (
                        <div className={`
                          flex items-center space-x-2 px-3 py-1 rounded-md text-sm
                          ${isDark 
                            ? 'bg-red-600 text-white' 
                            : 'bg-red-600 text-white'
                          }
                        `}>
                          <NoSymbolIcon className="w-4 h-4" />
                          <span>Audio Error</span>
                        </div>
                      )}

                      {/* Audio Streaming Status */}
                      {hasPermission && isReady && (
                        <div className={`
                          flex items-center space-x-2 px-3 py-1 rounded-md text-sm
                          ${isStreaming 
                            ? isDark 
                              ? 'bg-green-600 text-white' 
                              : 'bg-green-600 text-white'
                            : isDark 
                              ? 'bg-gray-600 text-gray-300' 
                              : 'bg-gray-200 text-gray-600'
                          }
                        `}>
                          <div className={`
                            w-2 h-2 rounded-full
                            ${isStreaming ? 'bg-white' : 'bg-gray-400'}
                          `} />
                          <span>
                            {isStreaming ? 'Streaming' : 'Ready'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Language Selector */}
                  <div className="flex items-center space-x-2">
                    <LanguageIcon className="w-4 h-4" />
                    <select
                      value={selectedLanguage}
                      onChange={(e) => updateLanguagePreference(e.target.value)}
                      className={`
                        px-3 py-1 border rounded-md text-sm
                        ${isDark 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                        }
                      `}
                    >
                      {CONFERENCE_CONSTANTS.SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Host Controls */}
                  {isHost && hasActiveSession && (
                    <div className="flex items-center space-x-2">
                      {!isSessionStarted ? (
                        <button
                          onClick={handleStartConference}
                          className={`
                            flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors
                            ${isDark 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-green-600 hover:bg-green-700 text-white'
                            }
                          `}
                        >
                          <PlayIcon className="w-4 h-4" />
                          <span>Start Conference</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleEndConference}
                          className={`
                            flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors
                            ${isDark 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-red-600 hover:bg-red-700 text-white'
                            }
                          `}
                        >
                          <StopIcon className="w-4 h-4" />
                          <span>End Conference</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Disconnect Button */}
                  <button
                    onClick={handleDisconnect}
                    className={`
                      flex items-center space-x-2 px-3 py-1 rounded-md text-sm font-medium transition-colors
                      ${isDark 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                      }
                    `}
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span>{t('disconnect')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className={`
              border-b
              ${isDark ? 'border-gray-700' : 'border-gray-200'}
            `}>
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors
                        ${activeTab === tab.id
                          ? isDark
                            ? 'border-blue-400 text-blue-400'
                            : 'border-blue-500 text-blue-600'
                          : isDark
                            ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Chat Input - Always visible for active sessions */}
            {hasActiveSession && (
              <div className={`
                p-4 rounded-lg border
                ${isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
                }
              `}>
                <div className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        if (e.target.value.trim()) {
                          handleTypingStart();
                        } else {
                          handleTypingStop();
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      onBlur={handleTypingStop}
                      placeholder="Type your message or question..."
                      className={`
                        w-full px-4 py-2 border rounded-lg resize-none
                        ${isDark 
                          ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' 
                          : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                        }
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                      `}
                      rows="2"
                    />
                    {isTyping && (
                      <div className={`
                        text-xs mt-1
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        Typing...
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                    className={`
                      px-4 py-2 rounded-lg font-medium transition-colors
                      ${!chatInput.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isDark 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }
                    `}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Tab Content */}
            <div className="min-h-[600px]">
              <ActiveComponent />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConferenceDashboard;
