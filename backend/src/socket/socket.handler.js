export default class SocketHandler {
  constructor(io, transcriptionAgent) {
    this.io = io;
    this.transcriptionAgent = transcriptionAgent;

    // 🧠 Store captions per session
    this.sessionCaptions = new Map();
  }

  async initialize() {
    this.io.on("connection", (socket) => {
      console.log("🔌 Client connected:", socket.id);

      /* ================= CONNECTION STATUS ================= */
      socket.emit("connected", {
        socketId: socket.id,
        connected: true
      });

      socket.emit("connectionStatus", {
        connected: true
      });

      /* ================= JOIN SESSION ================= */
      socket.on("join_session", ({ sessionId }) => {
        socket.join(sessionId);
        console.log(`📥 Socket ${socket.id} joined session ${sessionId}`);

        if (!this.sessionCaptions.has(sessionId)) {
          this.sessionCaptions.set(sessionId, []);
        }
      });

      /* ================= AUDIO STREAM ================= */
      socket.on("audio_chunk", async ({ sessionId, audio }) => {
        console.log("🎧 Audio chunk received", {
          sessionId,
          length: audio?.length
        });

        try {
          const audioBuffer = float32Chunk.buffer;
          const result = await this.transcriptionAgent.transcribe(audio);

          if (!result || !result.text) return;

          const caption = {
            text: result.text,
            timestamp: Date.now()
          };

          // 🧠 store caption
          this.sessionCaptions.get(sessionId)?.push(caption.text);

          // 📢 send caption to all in session
          this.io.to(sessionId).emit("caption:update", caption);
        } catch (err) {
          console.error("❌ Transcription error:", err.message);
        }
      });

      /* ================= GENERATE SUMMARY ================= */
      socket.on("generate_summary", ({ sessionId }) => {
        const captions = this.sessionCaptions.get(sessionId) || [];

        if (captions.length === 0) {
          socket.emit("summaryUpdate", {
            error: "No captions available"
          });
          return;
        }

        const summaryText = captions.join(" ").slice(0, 500);

        this.io.to(sessionId).emit("summaryUpdate", {
          text: summaryText
        });
      });

      /* ================= DISCONNECT ================= */
      socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);

        socket.emit("connectionStatus", {
          connected: false
        });
      });
    });
  }
}
