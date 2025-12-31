import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient.js";
import { generateToken } from "../utils/jwt.js";
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail
} from "../utils/email.js";

/* ================= SIGNUP ================= */

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: "LOCAL",
        role: "VIEWER",
        isVerified: false,
        verificationToken
      }
    });

    try {
      await sendVerificationEmail(email, name, verificationToken);
    } catch (err) {
      console.error("Email sending failed:", err);
    }

    return res.status(201).json({
      success: true,
      message: "Signup successful. Please verify your email.",
      data: {
        requiresVerification: true
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ================= LOGIN ================= */

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ================= VERIFY EMAIL ================= */

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required"
      });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ================= PROFILE ================= */

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        isVerified: true
      }
    });

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* ================= OAUTH HANDLER ================= */

const handleOAuthUser = async (profile, provider) => {
  const email = profile.emails[0].value;
  const name = profile.displayName || email.split("@")[0];
  const avatar = profile.photos?.[0]?.value;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        avatar,
        provider: provider.toUpperCase(),
        role: "VIEWER",
        isVerified: true
      }
    });

    try {
      await sendWelcomeEmail(email, name, provider);
    } catch {}
  }

  return user;
};

/* ================= ✅ EXPLICIT EXPORTS ================= */

export {
  signup,
  login,
  verifyEmail,
  getProfile,
  handleOAuthUser
};
