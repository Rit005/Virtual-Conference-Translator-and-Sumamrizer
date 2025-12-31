import nodemailer from "nodemailer";
import crypto from "crypto";

/* ================= SMTP CONFIG ================= */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP error:", error.message);
  } else {
    console.log("📧 SMTP server ready");
  }
});

/* ================= TOKEN ================= */

export const generateVerificationToken = () =>
  crypto.randomBytes(32).toString("hex");

/* ================= EMAIL TEMPLATE ================= */

const verificationTemplate = (name, url) => `
  <h2>Hi ${name} 👋</h2>
  <p>Please verify your email:</p>
  <a href="${url}">Verify Email</a>
  <p>${url}</p>
`;

/* ================= SEND VERIFICATION ================= */

export const sendVerificationEmail = async (email, name, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify your email",
    html: verificationTemplate(name, verificationUrl),
  });

  console.log("✅ Verification email sent:", verificationUrl);
};

/* ================= WELCOME (OAUTH) ================= */

export const sendWelcomeEmail = async (email, name, provider) => {
  await transporter.sendMail({
    from: `"Virtual Conference" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Welcome to Virtual Conference",
    html: `<h2>Welcome ${name}</h2><p>Signed up using ${provider}</p>`,
  });
};
