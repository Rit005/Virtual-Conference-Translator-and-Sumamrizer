import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email configuration
const getEmailConfig = () => {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
};

// Create email transporter
const transporter = nodemailer.createTransport(getEmailConfig());

/**
 * Generate secure verification token
 */
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate verification email template
 */
const generateVerificationEmail = (name, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Email Verification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { background: #e9ecef; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Virtual Conference</h1>
          <p>Welcome to our platform!</p>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for signing up for Virtual Conference Translator & Summarizer!</p>
          <p>To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
          <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          <p>If you didn't create an account with us, please ignore this email.</p>
          <p>&copy; 2024 Virtual Conference Team. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, name, verificationToken) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: {
        name: 'Virtual Conference Team',
        address: process.env.SMTP_USER || 'noreply@virtualconference.com'
      },
      to: email,
      subject: 'Verify Your Email - Virtual Conference',
      html: generateVerificationEmail(name, verificationUrl),
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send welcome email (for OAuth users)
 */
export const sendWelcomeEmail = async (email, name, provider) => {
  try {
    const mailOptions = {
      from: {
        name: 'Virtual Conference Team',
        address: process.env.SMTP_USER || 'noreply@virtualconference.com'
      },
      to: email,
      subject: 'Welcome to Virtual Conference!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; }
            .footer { background: #e9ecef; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Welcome to Virtual Conference!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Welcome to Virtual Conference Translator & Summarizer! 🎉</p>
              <p>You've successfully signed up using your ${provider} account.</p>
              <p>You can now:</p>
              <ul>
                <li>Join conference sessions</li>
                <li>Participate in real-time discussions</li>
                <li>Get AI-powered summaries and translations</li>
                <li>Connect with participants worldwide</li>
              </ul>
            </div>
            <div class="footer">
              <p>&copy; 2024 Virtual Conference Team. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};

export default transporter;
