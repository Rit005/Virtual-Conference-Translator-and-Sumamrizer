import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context Providers
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { WebSocketProvider } from './contexts/WebSocketContext.jsx';

// Layout Components
import MainLayout from './components/layout/MainLayout.jsx';

// Auth Components
import Login from './components/auth/Login.jsx';
import Signup from './components/auth/Signup.jsx';
import OAuthSuccess from './components/auth/OAuthSuccess.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';

// Conference Components
import ConferenceDashboard from './components/conference/ConferenceDashboard.jsx';

// Initialize i18n
import './i18n/index.js';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <ThemeProvider>
            <div className="App">
              <Routes>
                {/* Public Routes */}
                <Route 
                  path="/login" 
                  element={
                    <MainLayout>
                      <Login />
                    </MainLayout>
                  } 
                />
                <Route 
                  path="/signup" 
                  element={
                    <MainLayout>
                      <Signup />
                    </MainLayout>
                  } 
                />
                <Route 
                  path="/oauth-success" 
                  element={
                    <MainLayout>
                      <OAuthSuccess />
                    </MainLayout>
                  } 
                />
                
                {/* Protected Routes */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <ConferenceDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/conference/:sessionId" 
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <ConferenceDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Fallback Route */}
                <Route 
                  path="*" 
                  element={<Navigate to="/" replace />} 
                />
              </Routes>
              
              {/* Toast Notifications */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#374151',
                    color: '#f9fafb',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#f9fafb',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#f9fafb',
                    },
                  },
                }}
              />
            </div>
          </ThemeProvider>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
