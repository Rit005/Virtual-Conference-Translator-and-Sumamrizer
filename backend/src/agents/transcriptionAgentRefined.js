import wav from "wav";

class TranscriptionAgentRefined {
  constructor({ asrService }) {
    this.asrService = asrService;
    this.audioBuffer = [];
    this.sampleRate = 16000;
    this.requiredSamples = this.sampleRate * 2.5; // 2.5 seconds
  }

  async initialize() {
    console.log("🎙️ TranscriptionAgent initialized");
  }

  async shutdown() {
    this.audioBuffer = [];
  }

  async handleAudioChunk(float32Chunk) {
    if (!(float32Chunk instanceof Float32Array)) {
      console.warn("⚠️ Expected Float32Array audio chunk");
      return null;
    }

    this.audioBuffer.push(...float32Chunk);

    if (this.audioBuffer.length < this.requiredSamples) {
      return null;
    }

    const pcmSamples = new Float32Array(this.audioBuffer);
    this.audioBuffer = [];

    try {
      const wavBuffer = await this.convertPCMToWav(pcmSamples);
      return await this.asrService.transcribe(wavBuffer, {
        language: "en",
      });
    } catch (err) {
      console.error("❌ Transcription error:", err.message);
      return null;
    }
  }

  convertPCMToWav(float32Array) {
    return new Promise((resolve, reject) => {
      try {
        const writer = new wav.Writer({
          channels: 1,
          sampleRate: this.sampleRate,
          bitDepth: 16,
        });

        const chunks = [];
        writer.on("data", (d) => chunks.push(d));
        writer.on("end", () => resolve(Buffer.concat(chunks)));

        const pcm16 = Buffer.alloc(float32Array.length * 2);
        for (let i = 0; i < float32Array.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Array[i]));
          pcm16.writeInt16LE(s * 32767, i * 2);
        }

        writer.write(pcm16);
        writer.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default TranscriptionAgentRefined;