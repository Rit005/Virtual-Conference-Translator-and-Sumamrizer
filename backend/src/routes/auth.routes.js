import express from "express";
import passport from "passport";
import { generateToken } from "../utils/jwt.js";
import { signup, login, verifyToken, getProfile, verifyEmail } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Basic authentication routes
router.post("/signup", signup);
router.post("/login", login);

// Email verification route
router.get("/verify-email", verifyEmail);

// Get user profile
router.get("/profile", authenticate, getProfile);

// Verify token
router.get("/verify", authenticate, verifyToken);

// GOOGLE OAuth
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`http://localhost:5173/oauth-success?token=${token}`);
  }
);

// GITHUB OAuth
router.get("/github",
  passport.authenticate("github")
);

router.get("/github/callback",
  passport.authenticate("github", { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`http://localhost:5173/oauth-success?token=${token}`);
  }
);

export default router;
