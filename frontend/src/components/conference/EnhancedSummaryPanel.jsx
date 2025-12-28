import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme.js';
import { 
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const EnhancedSummaryPanel = ({ 
  summary, 
  isGenerating, 
  onGenerateSummary, 
  isConnectedToSession,
  meetingDuration,
  participantsCount = 12
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');

  // Handle request summary
  const handleRequestSummary = async () => {
    if (!isConnectedToSession || isGenerating) return;
    await onGenerateSummary();
  };

  // Format duration helper
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Parse structured data safely
  const parseJsonField = (field) => {
    if (!field) return [];
    try {
      return Array.isArray(field) ? field : JSON.parse(field);
    } catch (e) {
      console.warn('Failed to parse JSON field:', field);
      return [];
    }
  };

  // Extract structured summary data
  const structuredSummary = {
    content: summary?.content || '',
    keyPoints: parseJsonField(summary?.keyPoints || summary?.summary?.keyPoints),
    actionItems: parseJsonField(summary?.actionItems || summary?.summary?.actionItems),
    questions: parseJsonField(summary?.questions || summary?.summary?.questions),
    topics: parseJsonField(summary?.summary?.topics || summary?.metadata?.topics),
    sentiment: summary?.summary?.sentiment || summary?.metadata?.sentiment || 'neutral',
    confidence: summary?.summary?.confidence || summary?.metadata?.confidence || 0,
    metadata: summary?.metadata || summary?.summary?.metadata || {}
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: DocumentTextIcon },
    { id: 'keypoints', label: 'Key Points', icon: ClipboardDocumentListIcon, count: structuredSummary.keyPoints.length },
    { id: 'actions', label: 'Action Items', icon: CheckCircleIcon, count: structuredSummary.actionItems.length },
    { id: 'questions', label: 'Questions', icon: QuestionMarkCircleIcon, count: structuredSummary.questions.length }
  ];

  // No connection state
  if (!isConnectedToSession) {
    return (
      <div className={`
        h-full flex flex-col rounded-lg border
        ${isDark 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
        }
      `}>
        {/* Header */}
        <div className={`
          p-4 border-b
          ${isDark ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="w-6 h-6 text-blue-500" />
            <h3 className={`
              text-lg font-semibold
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {t('summary')}
            </h3>
          </div>
        </div>
        
        {/* No connection content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <DocumentTextIcon className={`
              w-16 h-16 mb-4 mx-auto
              ${isDark ? 'text-gray-600' : 'text-gray-300'}
            `} />
            <h4 className={`
              text-lg font-medium mb-2
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}>
              No Active Session
            </h4>
            <p className={`
              text-sm
              ${isDark ? 'text-gray-500' : 'text-gray-500'}
            `}>
              Connect to a conference to generate summaries
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      h-full flex flex-col rounded-lg border
      ${isDark 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
      }
    `}>
      {/* Header */}
      <div className={`
        p-4 border-b
        ${isDark ? 'border-gray-700' : 'border-gray-200'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="w-6 h-6 text-blue-500" />
            <h3 className={`
              text-lg font-semibold
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {t('summary')}
            </h3>
            {isConnectedToSession && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-500 font-medium">LIVE</span>
              </div>
            )}
          </div>

          <button
            onClick={handleRequestSummary}
            disabled={isGenerating}
            className={`
              flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors
              ${isGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            {isGenerating ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SparklesIcon className="w-4 h-4" />
            )}
            <span>{isGenerating ? 'Generating...' : 'Generate Summary'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Loading state */}
        {isGenerating && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-pulse" />
              <h4 className={`
                text-lg font-medium mb-2
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Generating AI Summary...
              </h4>
              <p className={`
                text-sm
                ${isDark ? 'text-gray-400' : 'text-gray-500'}
              `}>
                Analyzing transcriptions and generating structured insights
              </p>
            </div>
          </div>
        )}

        {/* No summary state */}
        {!isGenerating && !summary && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DocumentTextIcon className={`
                w-16 h-16 mb-4 mx-auto
                ${isDark ? 'text-gray-600' : 'text-gray-300'}
              `} />
              <h4 className={`
                text-lg font-medium mb-2
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                No Summary Available
              </h4>
              <p className={`
                text-sm mb-4
                ${isDark ? 'text-gray-500' : 'text-gray-500'}
              `}>
                Generate a summary to see key points, action items, and questions
              </p>
              <button
                onClick={handleRequestSummary}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
              >
                <SparklesIcon className="w-4 h-4" />
                <span>Generate Summary</span>
              </button>
            </div>
          </div>
        )}

        {/* Summary content */}
        {!isGenerating && summary && (
          <>
            {/* Tab Navigation */}
            <div className={`
              border-b
              ${isDark ? 'border-gray-700' : 'border-gray-200'}
            `}>
              <nav className="flex space-x-8 px-4">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors
                        ${activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : isDark
                            ? 'border-transparent text-gray-400 hover:text-gray-300'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`
                          text-xs px-2 py-1 rounded-full
                          ${activeTab === tab.id
                            ? 'bg-blue-100 text-blue-800'
                            : isDark
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-100 text-gray-600'
                          }
                        `}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Meeting Stats */}
                  <div className={`
                    p-4 rounded-lg border
                    ${isDark 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-gray-50 border-gray-200'
                    }
                  `}>
                    <h4 className={`
                      text-lg font-semibold mb-3
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      Meeting Overview
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className={`
                            text-sm font-medium
                            ${isDark ? 'text-gray-300' : 'text-gray-700'}
                          `}>
                            Duration
                          </p>
                          <p className={`
                            text-lg font-bold
                            ${isDark ? 'text-white' : 'text-gray-900'}
                          `}>
                            {formatDuration(meetingDuration || 45)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserGroupIcon className="w-5 h-5 text-green-500" />
                        <div>
                          <p className={`
                            text-sm font-medium
                            ${isDark ? 'text-gray-300' : 'text-gray-700'}
                          `}>
                            Participants
                          </p>
                          <p className={`
                            text-lg font-bold
                            ${isDark ? 'text-white' : 'text-gray-900'}
                          `}>
                            {participantsCount}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Sentiment & Confidence */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Sentiment:</span>
                          <span className={`
                            text-sm px-2 py-1 rounded-full
                            ${structuredSummary.sentiment === 'positive' 
                              ? 'bg-green-100 text-green-800'
                              : structuredSummary.sentiment === 'negative'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          `}>
                            {structuredSummary.sentiment}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Confidence:</span>
                          <span className="text-sm font-bold">
                            {Math.round(structuredSummary.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Content */}
                  {structuredSummary.content && (
                    <div className={`
                      p-4 rounded-lg border
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-50 border-gray-200'
                      }
                    `}>
                      <h4 className={`
                        text-lg font-semibold mb-3
                        ${isDark ? 'text-white' : 'text-gray-900'}
                      `}>
                        Summary
                      </h4>
                      <p className={`
                        text-sm leading-relaxed
                        ${isDark ? 'text-gray-200' : 'text-gray-800'}
                      `}>
                        {structuredSummary.content}
                      </p>
                    </div>
                  )}

                  {/* Topics */}
                  {structuredSummary.topics.length > 0 && (
                    <div className={`
                      p-4 rounded-lg border
                      ${isDark 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-50 border-gray-200'
                      }
                    `}>
                      <h4 className={`
                        text-lg font-semibold mb-3
                        ${isDark ? 'text-white' : 'text-gray-900'}
                      `}>
                        Topics Covered
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {structuredSummary.topics.map((topic, index) => (
                          <span
                            key={index}
                            className={`
                              px-3 py-1 rounded-full text-sm
                              ${isDark 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-blue-100 text-blue-800'
                              }
                            `}
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Key Points Tab */}
              {activeTab === 'keypoints' && (
                <div>
                  {structuredSummary.keyPoints.length > 0 ? (
                    <ul className="space-y-3">
                      {structuredSummary.keyPoints.map((point, index) => (
                        <li
                          key={index}
                          className={`
                            flex items-start space-x-3 p-4 rounded-lg border-l-4 border-blue-500
                            ${isDark 
                              ? 'bg-gray-700 border-gray-600' 
                              : 'bg-gray-50 border-gray-200'
                            }
                          `}
                        >
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">{index + 1}</span>
                          </div>
                          <span className={`
                            text-sm leading-relaxed
                            ${isDark ? 'text-gray-200' : 'text-gray-800'}
                          `}>
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <ClipboardDocumentListIcon className={`
                        w-12 h-12 mx-auto mb-3
                        ${isDark ? 'text-gray-600' : 'text-gray-300'}
                      `} />
                      <p className={`
                        text-sm
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        No key points identified
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Items Tab */}
              {activeTab === 'actions' && (
                <div>
                  {structuredSummary.actionItems.length > 0 ? (
                    <ul className="space-y-3">
                      {structuredSummary.actionItems.map((item, index) => (
                        <li
                          key={index}
                          className={`
                            flex items-start space-x-3 p-4 rounded-lg border-l-4 border-green-500
                            ${isDark 
                              ? 'bg-gray-700 border-gray-600' 
                              : 'bg-gray-50 border-gray-200'
                            }
                          `}
                        >
                          <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className={`
                            text-sm leading-relaxed
                            ${isDark ? 'text-gray-200' : 'text-gray-800'}
                          `}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircleIcon className={`
                        w-12 h-12 mx-auto mb-3
                        ${isDark ? 'text-gray-600' : 'text-gray-300'}
                      `} />
                      <p className={`
                        text-sm
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        No action items identified
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Questions Tab */}
              {activeTab === 'questions' && (
                <div>
                  {structuredSummary.questions.length > 0 ? (
                    <ul className="space-y-3">
                      {structuredSummary.questions.map((question, index) => (
                        <li
                          key={index}
                          className={`
                            flex items-start space-x-3 p-4 rounded-lg border-l-4 border-yellow-500
                            ${isDark 
                              ? 'bg-gray-700 border-gray-600' 
                              : 'bg-gray-50 border-gray-200'
                            }
                          `}
                        >
                          <QuestionMarkCircleIcon className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className={`
                            text-sm leading-relaxed
                            ${isDark ? 'text-gray-200' : 'text-gray-800'}
                          `}>
                            {question}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <QuestionMarkCircleIcon className={`
                        w-12 h-12 mx-auto mb-3
                        ${isDark ? 'text-gray-600' : 'text-gray-300'}
                      `} />
                      <p className={`
                        text-sm
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        No questions identified
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Generated Info */}
        {summary?.createdAt && (
          <div className={`
            p-3 border-t text-center
            ${isDark 
              ? 'border-gray-700 text-gray-400' 
              : 'border-gray-200 text-gray-600'
            }
          `}>
            <p className="text-xs">
              Generated at {new Date(summary.createdAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSummaryPanel;
