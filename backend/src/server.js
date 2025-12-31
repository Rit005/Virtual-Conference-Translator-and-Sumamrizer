import express from "express";
import passport from "passport";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import "./config/passport.js";

// Load environment variables
dotenv.config();

// Database
import { prisma } from "./prismaClient.js";

// 🔥 AGENTS
import TranscriptionAgent from "./agents/transcriptionAgentRefined.js";
import WhisperASRService from "./services/whisper.service.js";

// Socket handler
import SocketHandler from "./socket/socket.handler.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import { router as sessionRoutes } from "./routes/session.routes.js";
import { router as summaryRoutes } from "./routes/summary.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";

/* ───────────────────────────────────────────── */
/* APP & SERVER SETUP */
/* ───────────────────────────────────────────── */

const app = express();
const server = createServer(app);

/* ───────────────────────────────────────────── */
/* ALLOWED FRONTEND ORIGINS (🔥 IMPORTANT FIX) */
/* ───────────────────────────────────────────── */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5182",
  "http://frontend:80"
];

/* ───────────────────────────────────────────── */
/* SECURITY & MIDDLEWARE */
/* ───────────────────────────────────────────── */

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

/* ✅ FIXED CORS */
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.use(passport.initialize());

/* ───────────────────────────────────────────── */
/* SOCKET.IO (✅ FIXED) */
/* ───────────────────────────────────────────── */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

/* ───────────────────────────────────────────── */
/* 🔥 TRANSCRIPTION AGENT INITIALIZATION */
/* ───────────────────────────────────────────── */

const asrService = new WhisperASRService({
  apiKey: process.env.OPENAI_API_KEY || "mock",
});

const transcriptionAgent = new TranscriptionAgent({
  asrService,
  enableDebugLogging: true,
});

await transcriptionAgent.initialize();

/* ───────────────────────────────────────────── */
/* SOCKET HANDLER */
/* ───────────────────────────────────────────── */

const socketHandler = new SocketHandler(io, transcriptionAgent);
await socketHandler.initialize();

console.log("✅ Socket.IO + Agents initialized");

/* ───────────────────────────────────────────── */
/* ROUTES */
/* ───────────────────────────────────────────── */

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/conference", conferenceRoutes);

/* ───────────────────────────────────────────── */
/* ERROR HANDLING */
/* ───────────────────────────────────────────── */

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((error, req, res, next) => {
  console.error("Global error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

/* ───────────────────────────────────────────── */
/* SERVER START */
/* ───────────────────────────────────────────── */

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔌 Socket.IO enabled`);
});

/* ───────────────────────────────────────────── */
/* GRACEFUL SHUTDOWN */
/* ───────────────────────────────────────────── */

const shutdown = async () => {
  console.log("🔴 Shutting down gracefully...");
  await transcriptionAgent.shutdown();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

export { app, server, prisma };
