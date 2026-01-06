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
        console.log("📥 JOIN SESSION RECEIVED:", sessionId);
      
        socket.join(sessionId);
      
        if (!this.sessionCaptions.has(sessionId)) {
          this.sessionCaptions.set(sessionId, []);
        }
      });
      

      /* ================= AUDIO STREAM ================= */
      socket.on("audio_chunk", async ({ sessionId, audio }) => {
        try {
          console.log(
            "🎧 AUDIO RECEIVED",
            sessionId,
            audio?.byteLength
          );
      
          // ✅ rebuild Float32Array from ArrayBuffer
          const float32Audio = new Float32Array(audio);
      
          const result = await this.transcriptionAgent.transcribe(float32Audio);
      
          if (!result || !result.text) return;
      
          const caption = {
            text: result.text,
            timestamp: Date.now()
          };
      
          this.sessionCaptions.get(sessionId)?.push(caption.text);
      
          this.io.to(sessionId).emit("liveCaption", caption);
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
