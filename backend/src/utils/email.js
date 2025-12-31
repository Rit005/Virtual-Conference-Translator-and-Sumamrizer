import nodemailer from "nodemailer";
import crypto from "crypto";

const getEmailConfig = () => ({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const transporter = nodemailer.createTransport(getEmailConfig());

transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP error:", error.message);
  } else {
    console.log("📧 SMTP server ready");
  }
});

export const generateVerificationToken = () =>
  crypto.randomBytes(32).toString("hex");

const generateVerificationEmail = (name, url) => `
  <h2>Hi ${name} 👋</h2>
  <p>Please verify your email:</p>
  <a href="${url}">Verify Email</a>
  <p>${url}</p>
`;

export const sendVerificationEmail = async (email, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify your email",
      html: generateVerificationEmail(name, verificationUrl),
    });

    console.log("✅ Verification email sent");
    console.log("🔗", verificationUrl);
    return true;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    console.log("🔗 Manual verify:", verificationUrl);
    return false;
  }
};
