export default class SocketHandler {
  constructor(io, transcriptionAgent) {
    this.io = io;
    this.transcriptionAgent = transcriptionAgent;
  }

  async initialize() {
    this.io.on("connection", (socket) => {
      console.log("🔌 Client connected");

      socket.on("audio_chunk", async (chunk) => {
        try {
          const text = await this.transcriptionAgent.transcribe(chunk);
          if (text) {
            socket.emit("caption", text);
          }
        } catch (err) {
          console.error("Transcription error:", err.message);
        }
      });

      socket.on("disconnect", () => {
        console.log("❌ Client disconnected");
      });
    });
  }
}