import React, { useState, useEffect, useContext, createContext } from 'react';
import { THEME_CONSTANTS } from '../utils/constants.js';

// Create the ThemeContext
export const ThemeContext = createContext();

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(THEME_CONSTANTS.LIGHT);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const initializeTheme = () => {
      try {
        // Check localStorage first
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme && [THEME_CONSTANTS.LIGHT, THEME_CONSTANTS.DARK].includes(savedTheme)) {
          setTheme(savedTheme);
        } else {
          // Check system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? THEME_CONSTANTS.DARK : THEME_CONSTANTS.LIGHT);
        }
      } catch (error) {
        console.error('Theme initialization error:', error);
        setTheme(THEME_CONSTANTS.LIGHT);
      }
    };

    initializeTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === THEME_CONSTANTS.DARK) {
      root.classList.add(THEME_CONSTANTS.DARK);
      root.classList.remove(THEME_CONSTANTS.LIGHT);
    } else {
      root.classList.add(THEME_CONSTANTS.LIGHT);
      root.classList.remove(THEME_CONSTANTS.DARK);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a theme
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setTheme(e.matches ? THEME_CONSTANTS.DARK : THEME_CONSTANTS.LIGHT);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === THEME_CONSTANTS.LIGHT ? THEME_CONSTANTS.DARK : THEME_CONSTANTS.LIGHT;
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setLightTheme = () => {
    setTheme(THEME_CONSTANTS.LIGHT);
    localStorage.setItem('theme', THEME_CONSTANTS.LIGHT);
  };

  const setDarkTheme = () => {
    setTheme(THEME_CONSTANTS.DARK);
    localStorage.setItem('theme', THEME_CONSTANTS.DARK);
  };

  const isDark = theme === THEME_CONSTANTS.DARK;
  const isLight = theme === THEME_CONSTANTS.LIGHT;

  const value = {
    theme,
    isDark,
    isLight,
    toggleTheme,
    setLightTheme,
    setDarkTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Export both provider and hook
// eslint-disable-next-line react-refresh/only-export-components
export { ThemeProvider, useTheme };
