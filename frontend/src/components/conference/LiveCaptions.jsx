import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme.js';
import { useWebSocket } from '../../contexts/WebSocketContext.jsx';
import { CONFERENCE_CONSTANTS } from '../../utils/constants.js';
import { 
  SpeakerWaveIcon,
  LanguageIcon,
  TrashIcon,
  ArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const LiveCaptions = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { 
    captions, 
    clearCaptions, 
    selectedLanguage, 
    updateLanguagePreference, 
    isConnectedToSession 
  } = useWebSocket();
  
  const captionsEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [fontSize, setFontSize] = useState(CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_NORMAL);
  const [isHighContrast, setIsHighContrast] = useState(false);

  // Debounced auto-scroll function
  const scrollToBottom = useCallback(
    debounce(() => {
      if (isAutoScrollEnabled && captionsEndRef.current) {
        captionsEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, CONFERENCE_CONSTANTS.AUTO_SCROLL_DEBOUNCE_MS),
    [isAutoScrollEnabled]
  );

  // Check if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
    
    setIsAutoScrollEnabled(isAtBottom);
    setShowScrollButton(!isAtBottom);
  }, []);

  // Get latency status configuration
  const getLatencyConfig = useCallback((latencyStatus) => {
    const configs = {
      [CONFERENCE_CONSTANTS.LATENCY_STATUS.EXCELLENT]: {
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: CheckCircleIcon,
        label: 'Excellent',
        ariaLabel: 'Excellent latency'
      },
      [CONFERENCE_CONSTANTS.LATENCY_STATUS.GOOD]: {
        color: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        icon: CheckCircleIcon,
        label: 'Good',
        ariaLabel: 'Good latency'
      },
      [CONFERENCE_CONSTANTS.LATENCY_STATUS.NORMAL]: {
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        icon: ClockIcon,
        label: 'Normal',
        ariaLabel: 'Normal latency'
      },
      [CONFERENCE_CONSTANTS.LATENCY_STATUS.POOR]: {
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
        icon: ExclamationTriangleIcon,
        label: 'Poor',
        ariaLabel: 'Poor latency'
      },
      [CONFERENCE_CONSTANTS.LATENCY_STATUS.BAD]: {
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        icon: XCircleIcon,
        label: 'Bad',
        ariaLabel: 'Bad latency'
      }
    };
    
    return configs[latencyStatus] || configs[CONFERENCE_CONSTANTS.LATENCY_STATUS.NORMAL];
  }, []);

  // Format latency display
  const formatLatency = useCallback((latency) => {
    if (!latency || latency < 0) return 'N/A';
    
    if (latency < 1000) {
      return `${latency}ms`;
    } else {
      return `${(latency / 1000).toFixed(1)}s`;
    }
  }, []);

  // Handle clear captions with confirmation
  const handleClearCaptions = useCallback(() => {
    if (window.confirm(t('clearAllCaptionsConfirm', 'Clear all captions?'))) {
      clearCaptions();
    }
  }, [clearCaptions, t]);

  // Auto-scroll when new captions arrive
  useEffect(() => {
    if (captions.length > 0) {
      scrollToBottom();
    }
  }, [captions, scrollToBottom]);

  // Add scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl/Cmd + Scroll to bottom
      if ((event.ctrlKey || event.metaKey) && event.key === 'End') {
        event.preventDefault();
        setIsAutoScrollEnabled(true);
        scrollToBottom();
      }
      
      // Ctrl/Cmd + Home to top
      if ((event.ctrlKey || event.metaKey) && event.key === 'Home') {
        event.preventDefault();
        setIsAutoScrollEnabled(false);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [scrollToBottom]);

  // Memoized caption rendering
  const renderedCaptions = useMemo(() => {
    return captions.map((caption, index) => {
      const latencyConfig = getLatencyConfig(caption.latencyStatus);
      const LatencyIcon = latencyConfig.icon;
      
      return (
        <div
          key={caption.id || index}
          className={`
            group p-4 rounded-lg border transition-all duration-200 animate-fade-in
            ${latencyConfig.bgColor} ${latencyConfig.borderColor}
            ${isHighContrast ? 'border-2' : 'border'}
            hover:shadow-md
          `}
          style={{ 
            animationDelay: `${index * CONFERENCE_CONSTANTS.CAPTION_FADE_IN_DELAY}ms` 
          }}
          role="article"
          aria-label={`Caption ${index + 1} from ${caption.speaker}`}
        >
          {/* Header with speaker, time, and latency */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <span className={`
                text-sm font-medium
                ${isDark ? 'text-gray-300' : 'text-gray-700'}
              `}>
                {caption.speaker || 'Speaker'}
              </span>
              <span className={`
                text-xs
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `}>
                {new Date(caption.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </span>
              {caption.sourceLanguage && (
                <span className={`
                  text-xs px-2 py-1 rounded-full
                  ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}
                `}>
                  {caption.sourceLanguage.toUpperCase()}
                </span>
              )}
            </div>
            
            {/* Latency Indicator */}
            {caption.latency !== undefined && (
              <div className={`
                flex items-center space-x-1 px-2 py-1 rounded-full
                ${latencyConfig.bgColor}
              `}>
                <LatencyIcon 
                  className={`w-3 h-3 ${latencyConfig.color}`}
                  aria-label={latencyConfig.ariaLabel}
                />
                <span className={`
                  text-xs font-medium
                  ${latencyConfig.color}
                `}>
                  {formatLatency(caption.latency)}
                </span>
              </div>
            )}
          </div>

          {/* Caption Content */}
          <div className="space-y-2">
            {/* Original Text */}
            <div>
              <p className={`
                leading-relaxed
                ${isHighContrast ? 'font-bold' : ''}
                ${isDark ? 'text-gray-200' : 'text-gray-800'}
              `}
              style={{ fontSize: `${fontSize}px` }}
              >
                {caption.originalText || caption.text}
              </p>
            </div>

            {/* Translated Text (if available) */}
            {caption.translatedText && caption.translatedText !== caption.originalText && (
              <div className={`
                pl-4 border-l-2
                ${isDark ? 'border-gray-600' : 'border-gray-300'}
              `}>
                <div className="flex items-center space-x-2 mb-1">
                  <LanguageIcon className="w-3 h-3 text-gray-400" />
                  <span className={`
                    text-xs font-medium
                    ${isDark ? 'text-gray-400' : 'text-gray-600'}
                  `}>
                    {caption.targetLanguage?.toUpperCase() || selectedLanguage.toUpperCase()}
                  </span>
                </div>
                <p className={`
                  leading-relaxed
                  ${isHighContrast ? 'font-bold' : ''}
                  ${isDark ? 'text-gray-300' : 'text-gray-600'}
                `}
                style={{ fontSize: `${fontSize}px` }}
                >
                  {caption.translatedText}
                </p>
                {caption.confidence && (
                  <div className="mt-1">
                    <span className={`
                      text-xs
                      ${isDark ? 'text-gray-500' : 'text-gray-400'}
                    `}>
                      {t('confidence', 'Confidence')}: {Math.round(caption.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [captions, getLatencyConfig, formatLatency, selectedLanguage, fontSize, isHighContrast, isDark, t]);

  return (
    <div className={`
      h-full flex flex-col rounded-lg border overflow-hidden
      ${isDark 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
      }
    `}>
      {/* Header */}
      <div className={`
        p-4 border-b
        ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SpeakerWaveIcon className="w-6 h-6 text-blue-500" />
            <h3 className={`
              text-lg font-semibold
              ${isDark ? 'text-white' : 'text-gray-900'}
            `}>
              {t('liveCaptions', 'Live Captions')}
            </h3>
            {isConnectedToSession && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-500 font-medium">
                  {t('live', 'LIVE')}
                </span>
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
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${isDark 
                    ? 'border-gray-600 bg-gray-700 text-white' 
                    : 'border-gray-300 bg-white text-gray-900'
                  }
                `}
                aria-label={t('selectLanguage', 'Select Translation Language')}
              >
                {CONFERENCE_CONSTANTS.SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size Controls */}
            <div className="flex items-center space-x-1 border rounded">
              <button
                onClick={() => setFontSize(CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_SMALL)}
                className={`
                  px-2 py-1 text-xs rounded-l
                  ${fontSize === CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_SMALL
                    ? 'bg-blue-500 text-white'
                    : isDark 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
                aria-label={t('smallFont', 'Small Font')}
              >
                A-
              </button>
              <button
                onClick={() => setFontSize(CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_NORMAL)}
                className={`
                  px-2 py-1 text-xs border-x
                  ${fontSize === CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_NORMAL
                    ? 'bg-blue-500 text-white'
                    : isDark 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
                aria-label={t('normalFont', 'Normal Font')}
              >
                A
              </button>
              <button
                onClick={() => setFontSize(CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_LARGE)}
                className={`
                  px-2 py-1 text-xs rounded-r
                  ${fontSize === CONFERENCE_CONSTANTS.CAPTION_FONT_SIZE_LARGE
                    ? 'bg-blue-500 text-white'
                    : isDark 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
                aria-label={t('largeFont', 'Large Font')}
              >
                A+
              </button>
            </div>

            {/* Accessibility Controls */}
            <button
              onClick={() => setIsHighContrast(!isHighContrast)}
              className={`
                px-2 py-1 text-xs rounded border
                ${isHighContrast
                  ? 'bg-yellow-500 text-black border-yellow-600'
                  : isDark 
                    ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }
              `}
              aria-label={t('highContrast', 'Toggle High Contrast')}
            >
              {t('highContrastShort', 'HC')}
            </button>

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
              title={t('clearAllCaptions', 'Clear all captions')}
              aria-label={t('clearAllCaptions', 'Clear all captions')}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Captions Display */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        role="log"
        aria-live="polite"
        aria-label={t('captionsLog', 'Live captions log')}
      >
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
              {t('noActiveSession', 'No Active Session')}
            </h4>
            <p className={`
              text-sm
              ${isDark ? 'text-gray-500' : 'text-gray-500'}
            `}>
              {t('connectToSeeCaptions', 'Connect to a conference to see live captions')}
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
              {t('waitingForCaptions', 'Waiting for captions...')}
            </p>
          </div>
        ) : (
          <>
            {renderedCaptions}
            <div ref={captionsEndRef} />
          </>
        )}
      </div>

      {/* Footer with Status */}
      {isConnectedToSession && (
        <div className={`
          p-3 border-t text-center
          ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}
        `}>
          <div className="flex items-center justify-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className={`
                ${isDark ? 'text-gray-400' : 'text-gray-600'}
              `}>
                {t('liveCaptioningActive', 'Live captioning active')}
              </span>
            </div>
            <span className={`
              ${isDark ? 'text-gray-500' : 'text-gray-400'}
            `}>
              • {captions.length} {t('captionsReceived', 'captions received')}
            </span>
            {captions.length > 0 && (
              <span className={`
                ${isDark ? 'text-gray-500' : 'text-gray-400'}
              `}>
                • {t('autoScrollEnabled', isAutoScrollEnabled ? 'Auto-scroll ON' : 'Auto-scroll OFF')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={() => {
            setIsAutoScrollEnabled(true);
            scrollToBottom();
          }}
          className={`
            fixed bottom-6 right-6 p-3 rounded-full shadow-lg transition-all duration-200
            bg-blue-500 hover:bg-blue-600 text-white
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            z-10
          `}
          aria-label={t('scrollToBottom', 'Scroll to bottom')}
        >
          <ArrowDownIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default LiveCaptions;
