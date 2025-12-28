import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme.js';
import { useWebSocket } from '../../contexts/WebSocketContext.jsx';
import { CONFERENCE_CONSTANTS } from '../../utils/constants.js';
import { 
  PlayIcon, 
  PauseIcon,
  SpeakerWaveIcon,
  LanguageIcon,
  TrashIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

const CaptionPanel = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { 
    captions, 
    clearCaptions, 
    translateCaption, 
    selectedLanguage, 
    updateLanguagePreference, 
    isConnectedToSession 
  } = useWebSocket();
  const captionsEndRef = useRef(null);

  // Auto-scroll to bottom when new captions arrive
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  // Handle clear captions
  const handleClearCaptions = () => {
    if (window.confirm('Clear all captions?')) {
      clearCaptions();
    }
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
            <SpeakerWaveIcon className="w-6 h-6 text-blue-500" />
            <h3 className={`
              text-lg font-semibold
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {t('liveCaptions')}
            </h3>
            {isConnectedToSession && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-500 font-medium">LIVE</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <div className="flex items-center space-x-1">
              <LanguageIcon className="w-4 h-4 text-gray-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => updateLanguagePreference(e.target.value)}
                className={`
                  text-sm border rounded px-2 py-1
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

            {/* Clear Button */}
            <button
              onClick={handleClearCaptions}
              disabled={captions.length === 0}
              className={`
                p-1 rounded transition-colors
                ${captions.length === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : isDark 
                    ? 'text-gray-300 hover:text-red-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                }
              `}
              title="Clear all captions"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Captions Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isConnectedToSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <SpeakerWaveIcon className={`
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
              Connect to a conference to see live captions
            </p>
          </div>
        ) : captions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="animate-pulse">
              <SpeakerWaveIcon className={`
                w-12 h-12 mb-3
                ${isDark ? 'text-gray-600' : 'text-gray-300'}
              `} />
            </div>
            <p className={`
              text-sm
              ${isDark ? 'text-gray-500' : 'text-gray-500'}
            `}>
              Waiting for captions...
            </p>
          </div>
        ) : (
          <>
            {captions.map((caption, index) => (
              <div
                key={caption.id || index}
                className={`
                  group p-3 rounded-lg border transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`
                        text-xs font-medium
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}
                      `}>
                        {caption.speaker || 'Speaker'}
                      </span>
                      <span className={`
                        text-xs
                        ${isDark ? 'text-gray-500' : 'text-gray-400'}
                      `}>
                        {formatTime(caption.timestamp)}
                      </span>
                      {caption.language && (
                        <span className={`
                          text-xs px-1.5 py-0.5 rounded
                          ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}
                        `}>
                          {caption.language.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className={`
                      text-sm leading-relaxed
                      ${isDark ? 'text-gray-200' : 'text-gray-800'}
                    `}>
                      {caption.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={captionsEndRef} />
          </>
        )}
      </div>

      {/* Footer */}
      {isConnectedToSession && (
        <div className={`
          p-3 border-t text-center
          ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}
        `}>
          <div className="flex items-center justify-center space-x-2 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className={`
              ${isDark ? 'text-gray-400' : 'text-gray-600'}
            `}>
              Live captioning active
            </span>
            <span className={`
              ${isDark ? 'text-gray-500' : 'text-gray-400'}
            `}>
              • {captions.length} captions received
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaptionPanel;
