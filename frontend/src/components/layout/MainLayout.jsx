import React from 'react';
import { useTheme } from '../../hooks/useTheme.js';
import Header from './Header.jsx';

const MainLayout = ({ children }) => {
  const { isDark } = useTheme();

  return (
    <div className={`
      min-h-screen transition-colors duration-200
      ${isDark 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
      }
    `}>
      <Header />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
