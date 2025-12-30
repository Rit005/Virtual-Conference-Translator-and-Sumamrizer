import express from "express";
import passport from "passport";
import { generateToken } from "../utils/jwt.js";
import {
  signup,
  login,
  verifyEmail,
  getProfile
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* ================= BASIC AUTH ================= */

router.post("/signup", signup);
router.post("/login", login);

router.get("/verify-email", verifyEmail);
router.get("/profile", authenticate, getProfile);

/* ================= GOOGLE OAUTH ================= */

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
  }
);

/* ================= GITHUB OAUTH ================= */

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
  }
);

export default router;
