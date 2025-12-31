import nodemailer from "nodemailer";
import crypto from "crypto";

/* ───────────────────────────────────────────── */
/* EMAIL CONFIG                                  */
/* ───────────────────────────────────────────── */

const getEmailConfig = () => ({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // false for Gmail
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ───────────────────────────────────────────── */
/* TRANSPORTER                                   */
/* ───────────────────────────────────────────── */

const transporter = nodemailer.createTransport(getEmailConfig());

// Verify SMTP on startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP error:", error.message);
  } else {
    console.log("📧 SMTP server ready");
  }
});

/* ───────────────────────────────────────────── */
/* TOKEN GENERATION                              */
/* ───────────────────────────────────────────── */

const generateVerificationToken = () =>
  crypto.randomBytes(32).toString("hex");

/* ───────────────────────────────────────────── */
/* EMAIL TEMPLATES                               */
/* ───────────────────────────────────────────── */

const generateVerificationEmail = (name, verificationUrl) => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif;">
  <h2>Hi ${name} 👋</h2>
  <p>Please verify your email address by clicking the link below:</p>
  <p>
    <a href="${verificationUrl}">Verify Email</a>
  </p>
  <p>If the link doesn't work, copy this:</p>
  <p>${verificationUrl}</p>
</body>
</html>
`;

const generateWelcomeEmail = (name, provider) => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif;">
  <h2>Welcome ${name}! 🎉</h2>
  <p>You signed up using <b>${provider}</b>.</p>
  <p>You can now join live conferences with real-time captions and summaries.</p>
</body>
</html>
`;

/* ───────────────────────────────────────────── */
/* SEND VERIFICATION EMAIL                       */
/* ───────────────────────────────────────────── */

const sendVerificationEmail = async (email, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify your email",
      html: generateVerificationEmail(name, verificationUrl),
    });

    console.log(`✅ Verification email sent → ${email}`);
    console.log(`🔗 Verification link: ${verificationUrl}`);
    return true;
  } catch (error) {
    console.error("❌ Verification email failed:", error.message);
    console.log(`⚠️ Manual verify link: ${verificationUrl}`);
    return false;
  }
};

/* ───────────────────────────────────────────── */
/* SEND WELCOME EMAIL (OAUTH)                    */
/* ───────────────────────────────────────────── */

const sendWelcomeEmail = async (email, name, provider) => {
  try {
    await transporter.sendMail({
      from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome to Virtual Conference 🎉",
      html: generateWelcomeEmail(name, provider),
    });

    console.log(`✅ Welcome email sent → ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Welcome email failed:", error.message);
    return false;
  }
};

/* ───────────────────────────────────────────── */
/* ✅ EXPLICIT EXPORTS (CRITICAL FIX)             */
/* ───────────────────────────────────────────── */

export {
  transporter,
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
};

export default transporter;
