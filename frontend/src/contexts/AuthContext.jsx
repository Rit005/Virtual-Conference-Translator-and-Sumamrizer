import React, { useState, useEffect, createContext, useContext } from "react";
import { authService } from "../services/authService";
import toast from "react-hot-toast";

/* ================= CREATE CONTEXT ================= */
const AuthContext = createContext();

/* ================= CUSTOM HOOK ================= */
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/* ================= PROVIDER ================= */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ================= INIT AUTH ================= */
  useEffect(() => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Auth init error:", error);
      authService.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= LOGIN (FIXED) ================= */
  const login = async (data) => {
    try {
      setLoading(true);

      const result = await authService.login(data);

      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        toast.success("Login successful!");
        return { success: true };
      }

      return {
        success: false,
        error: result.message || "Login failed",
      };
    } catch (error) {
      const response = error?.response?.data;

      // 🔥 EMAIL NOT VERIFIED HANDLING
      if (response?.code === "EMAIL_NOT_VERIFIED") {
        return {
          success: false,
          error: "Please verify your email before logging in.",
        };
      }

      return {
        success: false,
        error:
          response?.message ||
          "Invalid email or password",
      };
    } finally {
      setLoading(false);
    }
  };

  /* ================= OAUTH LOGIN ================= */
  const loginWithOAuth = async (token) => {
    try {
      setLoading(true);

      authService.setToken(token);
      const decodedUser = authService.getCurrentUser();

      if (!decodedUser) {
        throw new Error("Invalid OAuth token");
      }

      setUser(decodedUser);
      setIsAuthenticated(true);
      toast.success("Login successful!");
      return { success: true };
    } catch (error) {
      authService.logout();
      return {
        success: false,
        error: error.message || "OAuth login failed",
      };
    } finally {
      setLoading(false);
    }
  };

  /* ================= SIGNUP ================= */
  const signup = async (data) => {
    try {
      setLoading(true);

      const result = await authService.signup(data);

      // Email verification flow
      if (result.success && result.data?.requiresVerification) {
        return {
          success: true,
          data: result.data,
          message: result.message,
        };
      }

      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        toast.success("Account created successfully!");
      }

      return {
        success: result.success,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      const response = error?.response?.data;

      toast.error(
        response?.message || "Signup failed. Please try again."
      );

      return {
        success: false,
        error: response?.message,
      };
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOGOUT ================= */
  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
  };

  /* ================= CONTEXT VALUE ================= */
  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    loginWithOAuth,
    signup,
    logout,

    // Role helpers
    hasRole: (role) => user?.role === role,
    isAdmin: () => user?.role === "ADMIN",
    isModerator: () => user?.role === "MODERATOR",
    isHost: () => user?.role === "HOST",
    isViewer: () => user?.role === "VIEWER",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthProvider, useAuth };
