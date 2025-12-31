/**
 * Whisper ASR Service (REAL + PRODUCTION SAFE)
 * Compatible with TranscriptionAgentRefined
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import ASRService from "./asrService.js";

class WhisperASRService extends ASRService {
  constructor(config = {}) {
    super(config);

    this.config = {
      apiKey: process.env.OPENAI_API_KEY,
      model: "whisper-1",
      sampleRate: 16000,
      ...config
    };

    this.client = null;
    this.initialized = false;
  }

  /* ================= INIT ================= */

  async initialize() {
    if (!this.config.apiKey) {
      console.warn("⚠️ Whisper MOCK MODE (no API key)");
      this.initialized = true;
      return;
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey
    });

    this.initialized = true;
    console.log("✅ Whisper service initialized");
  }

  /* ================= PCM → WAV ================= */

  pcmToWav(float32Array) {
    const buffer = Buffer.alloc(44 + float32Array.length * 2);

    // RIFF header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + float32Array.length * 2, 4);
    buffer.write("WAVE", 8);

    // fmt chunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(this.config.sampleRate, 24);
    buffer.writeUInt32LE(this.config.sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);

    // data chunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(float32Array.length * 2, 40);

    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer.writeInt16LE(s * 32767, offset);
      offset += 2;
    }

    return buffer;
  }

  /* ================= TRANSCRIBE ================= */

  async transcribe(float32Audio) {
    if (!this.initialized) throw new Error("Whisper not initialized");

    if (!this.config.apiKey) {
      return {
        text: "Mock transcription",
        isFinal: true
      };
    }

    const wavBuffer = this.pcmToWav(float32Audio);
    const filePath = path.join("/tmp", `audio-${Date.now()}.wav`);

    fs.writeFileSync(filePath, wavBuffer);

    try {
      const response = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: this.config.model
      });

      return {
        text: response.text,
        isFinal: true
      };
    } finally {
      fs.unlinkSync(filePath);
    }
  }

  /* ================= CLEANUP ================= */

  async cleanup() {
    this.initialized = false;
    this.client = null;
  }
}

export default WhisperASRService;