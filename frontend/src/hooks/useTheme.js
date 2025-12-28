import { useTheme as useThemeContext } from '../contexts/ThemeContext.jsx';

// Re-export the useTheme hook for convenience
export const useTheme = useThemeContext;

// Additional theme-specific hooks
export const useIsDarkMode = () => {
  const { isDark } = useThemeContext();
  return isDark;
};

export const useIsLightMode = () => {
  const { isLight } = useThemeContext();
  return isLight;
};

// Theme actions
export const useThemeActions = () => {
  const { toggleTheme, setLightTheme, setDarkTheme } = useThemeContext();
  return { toggleTheme, setLightTheme, setDarkTheme };
};

// Get theme colors for custom components
export const useThemeColors = () => {
  const { isDark } = useThemeContext();
  
  return {
    background: isDark ? 'bg-gray-900' : 'bg-gray-50',
    surface: isDark ? 'bg-gray-800' : 'bg-white',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-600',
    primary: isDark ? 'text-blue-400' : 'text-blue-600',
    hover: isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
  };
};
