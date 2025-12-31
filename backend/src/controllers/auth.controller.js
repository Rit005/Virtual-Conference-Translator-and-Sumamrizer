import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient.js";
import { generateToken } from "../utils/jwt.js";
import {
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../utils/email.js";

/* ================= SIGNUP ================= */

export const signup = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(400).json({ success: false, message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const verificationToken = generateVerificationToken();

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "VIEWER",
      provider: "LOCAL",
      isVerified: false,
      verificationToken,
    },
  });

  await sendVerificationEmail(email, name, verificationToken);

  return res.status(201).json({
    success: true,
    message: "Signup successful. Verify your email.",
    data: { requiresVerification: true },
  });
};

/* ================= LOGIN ================= */

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  if (!user.isVerified) {
    return res.status(401).json({
      success: false,
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before login",
    });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
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
    },
  });
};

/* ================= VERIFY EMAIL (🔥 FIXED) ================= */

export const verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token missing" });
  }

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired verification link",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
    },
  });

  // ✅ IMPORTANT: NO REDIRECT
  return res.json({
    success: true,
    message: "Email verified successfully",
  });
};

/* ================= PROFILE ================= */

export const getProfile = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
    },
  });

  res.json({ success: true, user });
};

/* ================= OAUTH ================= */

export const handleOAuthUser = async (profile, provider) => {
  const email = profile.emails[0].value;
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.displayName,
        email,
        provider,
        role: "VIEWER",
        isVerified: true,
      },
    });

    await sendWelcomeEmail(email, user.name, provider);
  }

  return user;
};
