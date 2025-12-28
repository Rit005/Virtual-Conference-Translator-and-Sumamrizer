import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  QuestionMarkCircleIcon,
  StarIcon,
  StarIcon as StarOutlineIcon,
  TagIcon,
  ChatBubbleQuestionIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolidIcon,
  StarIcon as StarSolidIcon,
} from '@heroicons/react/24/solid';

const ChatQAPanel = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const {
    isConnected,
    chatMessages,
    sendChatMessage,
    likeMessage,
    clearChatMessages,
    markMessageAsQuestion,
    unmarkMessageAsQuestion,
    pinMessage,
    unpinMessage,
    getPinnedQuestions,
    pinnedQuestions,
    userRole
  } = useWebSocket();

  const [newMessage, setNewMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'questions', 'pinned'
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Question categories
  const questionCategories = [
    { id: 'technical', label: 'Technical', color: 'bg-blue-100 text-blue-800' },
    { id: 'general', label: 'General', color: 'bg-green-100 text-green-800' },
    { id: 'follow-up', label: 'Follow-up', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
  ];

  // Filter messages based on active tab
  const filteredMessages = useMemo(() => {
    if (!chatMessages) return [];
    
    switch (activeTab) {
      case 'questions':
        return chatMessages.filter(msg => msg.isQuestion);
      case 'pinned':
        return chatMessages.filter(msg => msg.isPinned);
      default:
        return chatMessages;
    }
  }, [chatMessages, activeTab]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  // Focus input on connect
  useEffect(() => {
    if (isConnected) {
      inputRef.current?.focus();
    }
  }, [isConnected]);

  // Load pinned questions when component mounts
  useEffect(() => {
    if (isConnected) {
      getPinnedQuestions();
    }
  }, [isConnected, getPinnedQuestions]);

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

  const handleMarkAsQuestion = (messageId) => {
    markMessageAsQuestion(messageId, selectedCategory || null);
  };

  const handleUnmarkAsQuestion = (messageId) => {
    unmarkMessageAsQuestion(messageId);
  };

  const handlePinQuestion = (messageId) => {
    pinMessage(messageId);
  };

  const handleUnpinQuestion = (messageId) => {
    unpinMessage(messageId);
  };

  const getCategoryColor = (category) => {
    const cat = questionCategories.find(c => c.id === category);
    return cat ? cat.color : 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category) => {
    const cat = questionCategories.find(c => c.id === category);
    return cat ? cat.label : category;
  };

  const isModerator = userRole === 'MODERATOR' || userRole === 'HOST';

  const renderMessage = (msg) => {
    const isOwnMessage = msg.user?.name === user?.name;
    const hasLiked = msg.likedByUser; // This would need to be implemented in the context

    return (
      <div
        key={msg.id}
        className={`p-3 rounded-lg border transition-all duration-200 ${
          msg.isPinned 
            ? isDark 
              ? 'bg-blue-900/20 border-blue-500/50 ring-1 ring-blue-500/30' 
              : 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
            : isOwnMessage
            ? isDark
              ? 'bg-blue-900/30 border-blue-700 ml-8'
              : 'bg-blue-100 ml-8 border-blue-200'
            : isDark
            ? 'bg-gray-700 border-gray-600'
            : 'bg-gray-50 border-gray-200'
        } ${msg.isQuestion ? 'ring-1 ring-yellow-400/50' : ''}`}
      >
        {/* Message Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {msg.user?.name}
              </span>
              {msg.isQuestion && (
                <div className="flex items-center space-x-1">
                  <QuestionMarkCircleIcon className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-yellow-600 font-medium">Q</span>
                </div>
              )}
              {msg.isPinned && (
                <div className="flex items-center space-x-1">
                  <StarSolidIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">PINNED</span>
                </div>
              )}
              {msg.pinnedBy && (
                <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  by {msg.pinnedBy.name}
                </span>
              )}
            </div>
          </div>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {formatTime(msg.timestamp)}
          </span>
        </div>

        {/* Question Category */}
        {msg.questionCategory && (
          <div className="mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(msg.questionCategory)}`}>
              <TagIcon className="w-3 h-3 mr-1" />
              {getCategoryLabel(msg.questionCategory)}
            </span>
          </div>
        )}

        {/* Message Text */}
        <p className={`${isDark ? 'text-white' : 'text-gray-900'} mb-3 leading-relaxed`}>
          {msg.text}
        </p>

        {/* Message Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Question Marking (All Users) */}
            {!msg.isQuestion ? (
              <div className="flex items-center space-x-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`text-xs border rounded px-2 py-1 ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select category</option>
                  {questionCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleMarkAsQuestion(msg.id)}
                  disabled={!selectedCategory}
                  className="text-xs text-yellow-600 hover:text-yellow-700 flex items-center space-x-1 disabled:opacity-50"
                  title="Mark as question"
                >
                  <QuestionMarkCircleIcon className="w-4 h-4" />
                  <span>Mark Q</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleUnmarkAsQuestion(msg.id)}
                className="text-xs text-gray-600 hover:text-gray-700 flex items-center space-x-1"
                title="Unmark as question"
              >
                <span>Remove Q</span>
              </button>
            )}

            {/* Moderator Pinning Controls */}
            {isModerator && msg.isQuestion && (
              <button
                onClick={() => handlePinQuestion(msg.id)}
                disabled={msg.isPinned}
                className={`text-xs flex items-center space-x-1 ${
                  msg.isPinned 
                    ? 'text-blue-600 cursor-not-allowed' 
                    : 'text-blue-600 hover:text-blue-700'
                }`}
                title={msg.isPinned ? 'Already pinned' : 'Pin question'}
              >
                <StarIcon className="w-4 h-4" />
                <span>Pin</span>
              </button>
            )}

            {isModerator && msg.isPinned && (
              <button
                onClick={() => handleUnpinQuestion(msg.id)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                title="Unpin question"
              >
                <StarOutlineIcon className="w-4 h-4" />
                <span>Unpin</span>
              </button>
            )}
          </div>

          {/* Like Button */}
          <button
            onClick={() => likeMessage(msg.id)}
            className={`flex items-center text-xs space-x-1 ${
              hasLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
            }`}
          >
            {hasLiked ? (
              <HeartSolidIcon className="w-4 h-4" />
            ) : (
              <HeartIcon className="w-4 h-4" />
            )}
            <span>{msg.likes || 0}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`h-full flex flex-col border rounded-lg ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ChatBubbleQuestionIcon className="w-6 h-6 text-blue-500" />
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Chat / Q&A
            </h3>
            {isConnected && (
              <span className="ml-2 text-xs text-green-500 font-medium">LIVE</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isModerator && (
              <div className="flex items-center space-x-1 text-xs text-blue-600">
                <ShieldCheckIcon className="w-4 h-4" />
                <span>Moderator</span>
              </div>
            )}
            <button
              onClick={clearChatMessages}
              disabled={!chatMessages.length}
              className="text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'all', label: 'All', icon: ChatBubbleLeftRightIcon },
            { id: 'questions', label: 'Q&A', icon: QuestionMarkCircleIcon },
            { id: 'pinned', label: 'Pinned', icon: StarIcon },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDark
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === 'questions' && (
                  <span className="bg-yellow-400 text-yellow-900 px-1 rounded text-xs">
                    {chatMessages?.filter(m => m.isQuestion).length || 0}
                  </span>
                )}
                {tab.id === 'pinned' && (
                  <span className="bg-blue-400 text-blue-900 px-1 rounded text-xs">
                    {chatMessages?.filter(m => m.isPinned).length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isConnected ? (
          <p className="text-center text-gray-500">
            Connect to a session to start chatting
          </p>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardDocumentListIcon className={`w-12 h-12 mx-auto mb-3 ${
              isDark ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {activeTab === 'questions' && 'No questions yet'}
              {activeTab === 'pinned' && 'No pinned questions'}
              {activeTab === 'all' && 'No messages yet'}
            </p>
          </div>
        ) : (
          filteredMessages.map(renderMessage)
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatQAPanel;
