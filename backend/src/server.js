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
import { prisma } from "./prismaClient.js";

// Agents
import TranscriptionAgent from "./agents/transcriptionAgentRefined.js";
import WhisperASRService from "./services/whisper.service.js";
import SocketHandler from "./socket/socket.handler.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import { router as sessionRoutes } from "./routes/session.routes.js";
import { router as summaryRoutes } from "./routes/summary.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";

/* ───────────────────────────────────────────── */
/* ENV */
/* ───────────────────────────────────────────── */
dotenv.config();

/* ───────────────────────────────────────────── */
/* APP SETUP */
/* ───────────────────────────────────────────── */
const app = express();
const server = createServer(app);

/* ───────────────────────────────────────────── */
/* ✅ ALLOWED ORIGINS (FIXED) */
/* ───────────────────────────────────────────── */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5180",
  "http://localhost:5181",
  "http://localhost:5182",
  "http://localhost:5183",
];

/* ───────────────────────────────────────────── */
/* SECURITY */
/* ───────────────────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

/* ───────────────────────────────────────────── */
/* ✅ CORS (🔥 FULL FIX) */
/* ───────────────────────────────────────────── */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman / curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("❌ Blocked by CORS:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // 🔥 VERY IMPORTANT

/* ───────────────────────────────────────────── */
/* BODY & COOKIES */
/* ───────────────────────────────────────────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(passport.initialize());

/* ───────────────────────────────────────────── */
/* SOCKET.IO (CORS SYNCED) */
/* ───────────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

/* ───────────────────────────────────────────── */
/* TRANSCRIPTION AGENT */
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
/* 404 */
/* ───────────────────────────────────────────── */
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/* ───────────────────────────────────────────── */
/* ERROR HANDLER */
/* ───────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error("🔥 Global error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

/* ───────────────────────────────────────────── */
/* START SERVER */
/* ───────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO enabled`);
});

/* ───────────────────────────────────────────── */
/* SHUTDOWN */
/* ───────────────────────────────────────────── */
const shutdown = async () => {
  console.log("🔴 Graceful shutdown...");
  await transcriptionAgent.shutdown();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
