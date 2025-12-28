import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient.js";

import { generateToken } from "../utils/jwt.js";
import { generateVerificationToken, sendVerificationEmail, sendWelcomeEmail } from "../utils/email.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
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

    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = generateVerificationToken();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        provider: "LOCAL",
        role: "VIEWER",
        isVerified: false,
        verificationToken,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, name, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with signup even if email fails
    }

    res.status(201).json({
      success: true,
      message: "Signup successful. Please check your email to verify your account.",
      data: {
        requiresVerification: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Check if user exists and has a password (local auth users)
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for a verification email."
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

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
        isVerified: user.isVerified
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required"
      });
    }

    const user = await prisma.user.findFirst({
      where: { 
        verificationToken: token,
        isVerified: false
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token"
      });
    }

    // Mark user as verified and remove verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null
      }
    });

    console.log(`✅ User ${user.email} verified successfully`);

    // Redirect to frontend login page with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?verified=true&message=Email verified successfully! You can now log in.`);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const verifyToken = async (req, res) => {
  try {
    // If we reach here, the middleware has already validated the token
    const user = req.user;
    
    res.json({
      success: true,
      message: "Token is valid",
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        avatar: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Handle OAuth user creation or login
 */
export const handleOAuthUser = async (profile, provider) => {
  try {
    const { id: providerId, displayName, emails, photos } = profile;
    const email = emails[0].value;
    const name = displayName || email.split('@')[0];
    const avatar = photos[0]?.value;

    // Try to find existing user
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Update existing user with provider info
      const updateData = {
        avatar,
        [`${provider.toLowerCase()}Id`]: providerId,
        provider: provider.toUpperCase(),
        isVerified: true // OAuth users are auto-verified
      };

      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          name,
          email,
          avatar,
          provider: provider.toUpperCase(),
          role: "VIEWER",
          isVerified: true,
          [`${provider.toLowerCase()}Id`]: providerId
        }
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(email, name, provider);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    return user;
  } catch (error) {
    console.error('OAuth user handling error:', error);
    throw new Error('Failed to process OAuth user');
  }
};
