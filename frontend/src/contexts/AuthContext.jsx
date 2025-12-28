import React, { useState, useEffect, createContext, useContext } from 'react';
import { authService } from "../services/authService";
import { AUTH_CONSTANTS } from '../utils/constants.js';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

// Create the AuthContext
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (data) => {
    try {
      setLoading(true);
      const result = await authService.login(data);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        toast.success('Login successful!');
      }
      
      return { success: result.success, error: result.message };
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const loginWithOAuth = async (token) => {
    try {
      setLoading(true);
      
      // Store the token
      authService.setToken(token);
      
      // Get user info from token
      const user = authService.getCurrentUser();
      if (user) {
        setUser(user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        // Clear invalid token
        authService.logout();
        return { success: false, error: 'Invalid authentication token' };
      }
    } catch (error) {
      console.error('OAuth login error:', error);
      // Clear token on error
      authService.logout();
      const errorMessage = error.message || 'OAuth login failed';
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (data) => {
    try {
      setLoading(true);
      const result = await authService.signup(data);
      
      // For email verification, we don't set user as authenticated
      // The user needs to verify email first
      if (result.success && result.data?.requiresVerification) {
        return { 
          success: true, 
          data: result.data,
          message: result.message 
        };
      } else if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        toast.success('Account created successfully!');
      }
      
      return { 
        success: result.success, 
        data: result.data,
        user: result.user,
        message: result.message 
      };
    } catch (error) {
      const errorMessage = error.message || 'Signup failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    try {
      authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  };

  const refreshToken = async () => {
    try {
      const newToken = await authService.refreshToken();
      return newToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    loginWithOAuth,
    signup,
    logout,
    refreshToken,
    // Helper methods
    hasRole: (role) => user?.role === role,
    isAdmin: () => user?.role === 'admin',
    isModerator: () => user?.role === 'MODERATOR',
    isHost: () => user?.role === 'HOST',
    isViewer: () => user?.role === 'VIEWER'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Export both provider and hook
// eslint-disable-next-line react-refresh/only-export-components
export { AuthProvider, useAuth };
