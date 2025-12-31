import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient.js";
import { generateToken } from "../utils/jwt.js";
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../utils/email.js";

/* ================= SIGNUP ================= */

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: "LOCAL",
        role: "VIEWER",
        isVerified: false,
        verificationToken,
      },
    });

    await sendVerificationEmail(email, name, verificationToken);

    return res.status(201).json({
      success: true,
      message: "Signup successful. Please verify your email.",
      data: { requiresVerification: true },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ================= LOGIN ================= */

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ================= VERIFY EMAIL ================= */

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/verify-email?status=error`
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
    },
  });

  return res.redirect(
    `${process.env.FRONTEND_URL}/verify-email?status=success`
  );
};

/* ================= PROFILE (🔥 MISSING EXPORT FIXED) ================= */

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
        isVerified: true,
      },
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ================= OAUTH ================= */

const handleOAuthUser = async (profile, provider) => {
  const email = profile.emails[0].value;
  const name = profile.displayName || email.split("@")[0];

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        provider: provider.toUpperCase(),
        role: "VIEWER",
        isVerified: true,
      },
    });

    await sendWelcomeEmail(email, name, provider);
  }

  return user;
};

/* ================= ✅ EXPORTS ================= */

export {
  signup,
  login,
  verifyEmail,
  getProfile,
  handleOAuthUser,
};
