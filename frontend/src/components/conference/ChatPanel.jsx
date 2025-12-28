import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  HeartIcon,
  UserCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const ChatPanel = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const {
    isConnected,
    chatMessages,
    sendChatMessage,
    likeMessage,
    clearChatMessages,
  } = useWebSocket();

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* Auto scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* Focus input on connect */
  useEffect(() => {
    if (isConnected) {
      inputRef.current?.focus();
    }
  }, [isConnected]);

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;
    sendChatMessage(newMessage.trim());
    setNewMessage('');
  };

  return (
    <div
      className={`h-full flex flex-col border rounded-lg ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-2">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-500" />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('Chat / Q&A')}
          </h3>
          {isConnected && (
            <span className="ml-2 text-xs text-green-500 font-medium">LIVE</span>
          )}
        </div>

        <button
          onClick={clearChatMessages}
          disabled={!chatMessages.length}
          className="text-gray-400 hover:text-red-500"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isConnected ? (
          <p className="text-center text-gray-500">
            Connect to a session to start chatting
          </p>
        ) : chatMessages.length === 0 ? (
          <p className="text-center text-gray-500">
            No messages yet
          </p>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.user === user?.name
                  ? 'bg-blue-100 ml-8'
                  : isDark
                  ? 'bg-gray-700'
                  : 'bg-gray-100'
              }`}
            >
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{msg.user}</span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <p className={`${isDark ? 'text-white' : 'text-gray-900'}`}>
                {msg.message}
              </p>
              <button
                onClick={() => likeMessage(msg.id)}
                className="mt-1 flex items-center text-xs text-gray-400 hover:text-red-500"
              >
                <HeartIcon className="w-3 h-3 mr-1" />
                {msg.likes || 0}
              </button>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isConnected && (
        <form
          onSubmit={handleSendMessage}
          className={`p-4 border-t flex space-x-2 ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('Type a message')}
            className={`flex-1 px-3 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white border-gray-300'
            }`}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 rounded-lg"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatPanel;
