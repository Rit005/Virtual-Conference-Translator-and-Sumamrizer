# 🎤 Virtual Conference Translator & Summarizer

A full-stack web application that enables **real-time virtual conferences** with **live speech-to-text captions**, **multi-language translation**, **chat/Q&A**, and **AI-generated summaries**.

---

## 🚀 Project Overview

This system allows users to host or join virtual conferences where spoken audio is:
- Captured in real time from the browser
- Transcribed using AI speech recognition
- Displayed as live captions
- Summarized automatically after the session

The platform is designed to simulate modern video-conferencing tools with an **AI-first architecture**.

---

## ✨ Key Features

### 🔐 Authentication
- Email & password login (JWT-based)
- OAuth login (Google / GitHub)
- Email verification for new users
- Role-based access:
  - **Viewer**
  - **Host**
  - **Moderator**

---

### 🎙️ Live Audio Streaming
- Browser microphone capture
- Real-time audio streaming via **WebSockets**
- PCM → WAV conversion for ASR processing
- Audio buffering & chunk-based processing

---

### 📝 Live Captions
- Real-time speech-to-text captions
- Powered by **OpenAI Whisper**
- Language selection support
- Low-latency caption updates

---

### 🌍 Multi-Language Support
- User-selectable caption language
- Language switching during sessions

---

### 💬 Chat / Q&A
- Real-time chat using Socket.IO
- Typing indicators
- Role-aware messaging

---

### 📄 AI-Generated Summary
- Auto-generated meeting summary
- Generated when the host ends a session
- Useful for meeting notes & records

---

## 🧠 System Architecture

### High-Level Flow

```text
Browser Microphone
        ↓
Audio Streaming (WebSocket)
        ↓
Transcription Agent
        ↓
Whisper ASR Service
        ↓
Live Captions (Frontend)
        ↓
Summary Generator

🖥️ Technology Stack
Frontend

React + Vite

Tailwind CSS

Context API (Auth, Theme, WebSocket)

Custom hooks for audio streaming

Socket.IO Client

Backend

Node.js + Express

Socket.IO

OpenAI Whisper (ASR)

Transcription Agent (PCM → WAV → ASR)

Prisma ORM

PostgreSQL / SQLite

📂 Project Structure (Simplified)
frontend/
 ├─ components/
 ├─ contexts/
 ├─ hooks/
 ├─ services/
 └─ pages/

backend/
 ├─ agents/
 ├─ services/
 ├─ socket/
 ├─ routes/
 ├─ prisma/
 └─ server.js

⚠️ Assumptions Made

Users grant microphone access in the browser

Stable internet connection for real-time streaming

OpenAI API key is configured in production

Conferences are short-to-medium duration

One primary speaker at a time (basic ASR setup)

WebSocket connections are authenticated after login

🧪 Limitations

No video streaming (audio-only conferences)

Basic speaker identification (no diarization)

Mock transcription used if API key is missing

No session recording playback (live only)

🚀 Running the Project Locally
Backend Setup
cd backend
npm install
npm run dev

Frontend Setup
cd frontend
npm install
npm run dev

🔑 Environment Variables

Create a .env file in the backend directory:

OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

📌 Future Enhancements

Speaker diarization

Video conferencing support

Session recording & playback

Advanced AI summarization

Noise suppression

Horizontal scaling with message queues

👨‍💻 Author

Rithik Sharma
Full Stack Developer | AI & Web Enthusiast

