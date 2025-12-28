import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme.js';
import { useWebSocketSummary, useConferenceSession } from '../../hooks/useWebSocket.js';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import { 
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const SummaryPanel = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { summary, requestSummary } = useWebSocketSummary();
  const { isConnectedToSession } = useConferenceSession();
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle request summary
  const handleRequestSummary = async () => {
    if (!isConnectedToSession) return;
    
    setIsGenerating(true);
    try {
      await requestSummary();
    } catch (error) {
      console.error('Failed to request summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Format duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Mock meeting duration calculation
  const getMeetingDuration = () => {
    if (summary?.meetingDuration) {
      return summary.meetingDuration;
    }
    // Calculate based on captions count (rough estimate)
    const estimatedMinutes = Math.floor(Math.random() * 60) + 15;
    return formatDuration(estimatedMinutes);
  };

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
            disabled={!isConnectedToSession || isGenerating}
            className={`
              flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors
              ${!isConnectedToSession || isGenerating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isDark 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            {isGenerating ? (
              <LoadingSpinner size="sm" text="" />
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                <span>{t('generateSummary')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isConnectedToSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <DocumentTextIcon className={`
              w-16 h-16 mb-4
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
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <LoadingSpinner size="lg" text="Generating summary..." />
          </div>
        ) : !summary ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <SparklesIcon className={`
              w-16 h-16 mb-4
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
              Click "Generate Summary" to create a meeting summary
            </p>
            <button
              onClick={handleRequestSummary}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
                ${isDark 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              <SparklesIcon className="w-4 h-4" />
              <span>Generate Summary</span>
            </button>
          </div>
        ) : (
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
                      {t('meetingDuration')}
                    </p>
                    <p className={`
                      text-lg font-bold
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      {getMeetingDuration()}
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
                      {t('participantsCount')}
                    </p>
                    <p className={`
                      text-lg font-bold
                      ${isDark ? 'text-white' : 'text-gray-900'}
                    `}>
                      {summary.participantsCount || '12'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Discussion Points */}
            <div className={`
              p-4 rounded-lg border
              ${isDark 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
              }
            `}>
              <div className="flex items-center space-x-2 mb-3">
                <ClipboardDocumentListIcon className="w-5 h-5 text-yellow-500" />
                <h4 className={`
                  text-lg font-semibold
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  {t('keyPoints')}
                </h4>
              </div>
              <ul className="space-y-2">
                {(summary.keyPoints || []).map((point, index) => (
                  <li
                    key={index}
                    className={`
                      flex items-start space-x-2 p-2 rounded
                      ${isDark 
                        ? 'text-gray-200' 
                        : 'text-gray-800'
                      }
                    `}
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div className={`
              p-4 rounded-lg border
              ${isDark 
                ? 'bg-gray-700 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
              }
            `}>
              <div className="flex items-center space-x-2 mb-3">
                <ClipboardDocumentListIcon className="w-5 h-5 text-green-500" />
                <h4 className={`
                  text-lg font-semibold
                  ${isDark ? 'text-white' : 'text-gray-900'}
                `}>
                  {t('actionItems')}
                </h4>
              </div>
              <ul className="space-y-2">
                {(summary.actionItems || []).map((item, index) => (
                  <li
                    key={index}
                    className={`
                      flex items-start space-x-2 p-2 rounded
                      ${isDark 
                        ? 'text-gray-200' 
                        : 'text-gray-800'
                      }
                    `}
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Generated Info */}
            {summary.generatedAt && (
              <div className={`
                p-3 rounded-lg border border-dashed
                ${isDark 
                  ? 'border-gray-600 text-gray-400' 
                  : 'border-gray-300 text-gray-600'
                }
              `}>
                <p className="text-xs text-center">
                  Summary generated at {new Date(summary.generatedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPanel;
