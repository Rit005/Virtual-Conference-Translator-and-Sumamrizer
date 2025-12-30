import { verifyToken } from "../utils/jwt.js";

export const authenticate = (req, res, next) => {
  try {
    let token = null;

    // ✅ 1. Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // ✅ 2. Fallback to cookie (Google OAuth flow)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // Debug logging for 400 errors
    console.log(`🔍 Auth attempt for ${req.method} ${req.originalUrl}`);
    console.log(`🔑 Token present: ${!!token}`);
    console.log(`📋 Auth header: ${authHeader}`);
    console.log(`🍪 Cookie token: ${!!req.cookies?.token}`);

    if (!token) {
      console.log(`❌ No token found for ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: "No token provided",
        path: req.originalUrl,
        method: req.method
      });
    }

    try {
      const decoded = verifyToken(token);
      console.log(`✅ Token decoded successfully for user: ${decoded.email}`);

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    } catch (tokenError) {
      console.log(`❌ Token verification failed for ${req.originalUrl}:`, tokenError.message);
      
      if (tokenError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
          path: req.originalUrl
        });
      }

      if (tokenError.name === "JsonWebTokenError") {
        return res.status(403).json({
          success: false,
          message: "Invalid token",
          path: req.originalUrl
        });
      }

      throw tokenError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("💥 Authentication error for", req.originalUrl, ":", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      path: req.originalUrl,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
