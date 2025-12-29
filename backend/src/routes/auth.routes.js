import express from "express";
import passport from "passport";
import { generateToken } from "../utils/jwt.js";
import {
  signup,
  login,
  verifyToken,
  getProfile,
  verifyEmail
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* ================= BASIC AUTH ================= */

router.post("/signup", signup);
router.post("/login", login);

router.get("/verify-email", verifyEmail);
router.get("/profile", authenticate, getProfile);
router.get("/verify", authenticate, verifyToken);

/* ================= GOOGLE OAUTH ================= */

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
  }
);


/* ================= GITHUB OAUTH (SAFE GUARD) ================= */

router.get("/github", (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(501).json({
      success: false,
      message: "GitHub OAuth not configured"
    });
  }

  passport.authenticate("github")(req, res, next);
});

router.get("/github/callback", (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=github_not_configured`
    );
  }

  passport.authenticate("github", { session: false })(req, res, () => {
    const token = generateToken(req.user);
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/oauth-success?token=${token}`
    );
  });
});

export default router;
