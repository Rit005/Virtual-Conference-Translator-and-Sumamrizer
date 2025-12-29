/**
 * Whisper ASR Service (Production Safe)
 * Compatible with TranscriptionAgentRefined
 */

import OpenAI from "openai";
import { Readable } from "stream";
import ASRService from "./asrService.js";

class WhisperASRService extends ASRService {
  constructor(config = {}) {
    super({
      maxAudioSize: 25 * 1024 * 1024,
      ...config
    });

    this.config = {
      apiKey: process.env.OPENAI_API_KEY || null,
      model: "whisper-1",
      timeout: 30000,
      maxRetries: 2,
      retryDelay: 1000,
      ...config
    };

    this.openai = null;
    this.initialized = false;
  }

  /* ================= INITIALIZATION ================= */

  async initialize() {
    if (!this.config.apiKey) {
      console.warn("⚠️ Whisper running in MOCK mode (no API key)");
      this.initialized = true;
      return true;
    }

    try {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout
      });

      this.initialized = true;
      console.log("✅ WhisperService initialized");
      return true;
    } catch (err) {
      console.error("❌ Whisper init failed:", err.message);
      this.initialized = false;
      return false;
    }
  }

  /* ================= VALIDATION ================= */

  validateAudioFormat(audioData) {
    if (!audioData) {
      return { valid: false, errors: ["Missing audio data"] };
    }

    const size = Buffer.isBuffer(audioData)
      ? audioData.length
      : Buffer.byteLength(audioData, "base64");

    if (size > this.config.maxAudioSize) {
      return {
        valid: false,
        errors: [`Audio size exceeds ${this.config.maxAudioSize} bytes`]
      };
    }

    return { valid: true, size };
  }

  /* ================= TRANSCRIPTION ================= */

  async transcribe(audioData, options = {}) {
    if (!this.initialized) {
      throw new Error("WhisperService not initialized");
    }

    /** 🔁 MOCK MODE */
    if (!this.config.apiKey) {
      return {
        text: "Mock transcription (Whisper not configured)",
        language: options.language || "en",
        confidence: 0.95,
        isFinal: false,
        duration: 2,
        metadata: { provider: "mock-whisper" }
      };
    }

    const audioBuffer = Buffer.isBuffer(audioData)
      ? audioData
      : Buffer.from(audioData, "base64");

    const audioStream = Readable.from(audioBuffer);

    let lastError;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.openai.audio.transcriptions.create({
          file: audioStream,
          model: this.config.model,
          language: options.language,
          response_format: "verbose_json"
        });

        return {
          text: response.text,
          language: response.language || options.language || "en",
          confidence: this.estimateConfidence(response.text),
          isFinal: true,
          duration: response.duration || 0,
          metadata: {
            provider: "openai-whisper",
            attempt
          }
        };
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, this.config.retryDelay));
      }
    }

    throw lastError;
  }

  /* ================= CONFIDENCE ================= */

  estimateConfidence(text = "") {
    if (!text.trim()) return 0;

    let score = 0.6;
    if (text.length > 40) score += 0.2;
    if (/[.!?]/.test(text)) score += 0.1;
    if (text.length < 10) score -= 0.3;

    return Math.min(1, Math.max(0, score));
  }

  /* ================= CLEANUP ================= */

  async cleanup() {
    this.initialized = false;
    this.openai = null;
  }
}

export default WhisperASRService;
