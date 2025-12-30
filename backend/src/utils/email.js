import nodemailer from 'nodemailer';
import crypto from 'crypto';

/* ───────────────────────────────────────────── */
/* EMAIL CONFIG                                  */
/* ───────────────────────────────────────────── */

const getEmailConfig = () => ({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // false for Gmail (587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ───────────────────────────────────────────── */
/* TRANSPORTER                                  */
/* ───────────────────────────────────────────── */

export const transporter = nodemailer.createTransport(getEmailConfig());

// ✅ Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP configuration error:', error.message);
  } else {
    console.log('📧 SMTP server is ready to send emails');
  }
});

/* ───────────────────────────────────────────── */
/* TOKEN GENERATION                              */
/* ───────────────────────────────────────────── */

export const generateVerificationToken = () =>
  crypto.randomBytes(32).toString('hex');

/* ───────────────────────────────────────────── */
/* EMAIL TEMPLATES                               */
/* ───────────────────────────────────────────── */

const generateVerificationEmail = (name, verificationUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Email Verification</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
  <div style="max-width:600px;margin:auto;background:#ffffff;padding:20px;border-radius:8px;">
    <h2>Hi ${name}, 👋</h2>
    <p>Welcome to <b>Virtual Conference Translator & Summarizer</b>.</p>
    <p>Please verify your email by clicking the button below:</p>

    <p style="text-align:center;">
      <a href="${verificationUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;
                text-decoration:none;border-radius:6px;">
        Verify Email
      </a>
    </p>

    <p>If the button doesn’t work, copy this link:</p>
    <p style="word-break: break-all;">${verificationUrl}</p>

    <p><b>Note:</b> This link expires in 24 hours.</p>

    <hr />
    <p style="font-size:12px;color:#777;">
      If you didn’t create this account, ignore this email.
    </p>
  </div>
</body>
</html>
`;

/* ───────────────────────────────────────────── */
/* SEND VERIFICATION EMAIL                       */
/* ───────────────────────────────────────────── */

export const sendVerificationEmail = async (email, name, token) => {
  const verificationUrl =
    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify your email',
      html: generateVerificationEmail(name, verificationUrl),
    });

    console.log(`✅ Verification email sent → ${email}`);
    console.log(`🔗 Verify link (DEV): ${verificationUrl}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email');
    console.error(error.message);

    // 🔥 Demo-safe fallback
    console.log('⚠️ EMAIL FALLBACK (FOR DEMO)');
    console.log(`🔗 Verify manually: ${verificationUrl}`);

    return false;
  }
};

/* ───────────────────────────────────────────── */
/* SEND WELCOME EMAIL (OAUTH)                    */
/* ───────────────────────────────────────────── */

export const sendWelcomeEmail = async (email, name, provider) => {
  try {
    await transporter.sendMail({
      from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Virtual Conference 🎉',
      html: `
        <h2>Welcome ${name}!</h2>
        <p>You signed up using <b>${provider}</b>.</p>
        <p>You can now join live conferences with real-time captions & summaries.</p>
      `,
    });

    console.log(`✅ Welcome email sent → ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return false;
  }
};

export default transporter;
