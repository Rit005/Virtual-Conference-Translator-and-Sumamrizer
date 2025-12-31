export default class TranscriptionAgent {
    constructor({ asrService }) {
      this.asrService = asrService;
      this.buffer = [];
    }
  
    async initialize() {
      console.log("🎙️ Transcription agent ready");
    }
  
    async transcribe(audioChunk) {
      this.buffer.push(...audioChunk);
  
      // Process every ~2 seconds
      if (this.buffer.length < 16000 * 2) return null;
  
      const pcmData = new Float32Array(this.buffer);
      this.buffer = [];
  
      const text = await this.asrService.transcribe(pcmData);
      return text;
    }
  
    async shutdown() {
      console.log("🛑 Transcription agent stopped");
    }
  }