import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  SunIcon, 
  MoonIcon, 
  LanguageIcon, 
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useTheme, useThemeActions } from '../../hooks/useTheme.js';
import { useAuth, useAuthActions } from '../../hooks/useAuth.js';
import { CONFERENCE_CONSTANTS } from '../../utils/constants.js';

const Header = () => {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { toggleTheme } = useThemeActions();
  const { user, isAuthenticated } = useAuth();
  const { logout } = useAuthActions();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  // Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className={`
      h-16 border-b transition-colors duration-200
      ${isDark 
        ? 'bg-gray-800 border-gray-700 text-white' 
        : 'bg-white border-gray-200 text-gray-900'
      }
    `}>
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">VC</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('conference')}
            </h1>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-4">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className={`
                p-2 rounded-lg transition-colors duration-200
                ${isDark 
                  ? 'hover:bg-gray-700 text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-600'
                }
              `}
              title={t('selectLanguage')}
            >
              <LanguageIcon className="w-5 h-5" />
            </button>

            {showLanguageMenu && (
              <div className={`
                absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50
                ${isDark 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
                }
              `}>
                {CONFERENCE_CONSTANTS.SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`
                      w-full px-4 py-2 text-left hover:bg-opacity-10 transition-colors duration-200
                      ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}
                      ${i18n.language === lang.code ? 'bg-opacity-20 bg-blue-600' : ''}
                    `}
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`
              p-2 rounded-lg transition-colors duration-200
              ${isDark 
                ? 'hover:bg-gray-700 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-600'
              }
            `}
            title={isDark ? t('lightMode') : t('darkMode')}
          >
            {isDark ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </button>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`
                  flex items-center space-x-2 p-2 rounded-lg transition-colors duration-200
                  ${isDark 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-100'
                  }
                `}
              >
                <UserCircleIcon className="w-6 h-6" />
                <span className="text-sm font-medium">{user.name}</span>
              </button>

              {showUserMenu && (
                <div className={`
                  absolute right-0 mt-2 w-56 rounded-lg shadow-lg border z-50
                  ${isDark 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'
                  }
                `}>
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <p className="text-xs text-blue-600 capitalize">{user.role}</p>
                  </div>
                  
                  <div className="p-2">
                    <button
                      onClick={() => setShowUserMenu(false)}
                      className={`
                        w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors duration-200
                        ${isDark 
                          ? 'hover:bg-gray-700 text-gray-300' 
                          : 'hover:bg-gray-100 text-gray-700'
                        }
                      `}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className={`
                        w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors duration-200
                        ${isDark 
                          ? 'hover:bg-gray-700 text-red-400' 
                          : 'hover:bg-gray-100 text-red-600'
                        }
                      `}
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Click outside handlers */}
      {(showUserMenu || showLanguageMenu) && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowLanguageMenu(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;
