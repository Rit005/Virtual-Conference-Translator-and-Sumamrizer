# 🎥 Virtual Conference Translator & Summarizer

A full-stack web application that enables **real-time virtual conferences** with **live speech-to-text captions**, **multi-language support**, **chat/Q&A**, and **AI-generated summaries** using modern web and AI technologies.

---

## 🎯 Project Overview

The Virtual Conference Translator & Summarizer is designed to enhance online meetings by integrating real-time audio processing, AI transcription, and summarization into a unified platform. It supports role-based participation (host, moderator, viewer), secure authentication, and live WebSocket-based communication to deliver captions instantly as users speak.

The platform focuses on accessibility, scalability, and real-time performance, making it suitable for online lectures, meetings, and webinars.

🚀 Key Features

🎤 Live Speech-to-Text Captions
Real-time audio capture and transcription using AI-powered ASR services.

🌍 Multilingual Translation Support
On-the-fly language translation for captions to support global participants.

📝 Automated Meeting Summaries
AI-generated summaries created after session completion.

🔐 Secure Authentication & Role Management
JWT-based authentication with role-based access (Host, Moderator, Viewer).

⚡ Real-Time Communication
WebSocket-powered live sessions for captions, chat, and participant updates.

📊 Session Management
Create, join, and manage conference sessions with participant tracking.

---

## 🧠 System Architecture

### High-Level Flow

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

yaml
Copy code

---

## 🛠️ Technology Stack

### 🎨 Frontend
- **React + Vite** – Fast modern frontend tooling  
- **Tailwind CSS** – Utility-first styling  
- **Context API** – Global state management  
  *(Authentication, Theme, WebSocket)*  
- **Custom React Hooks** – Audio streaming & microphone handling  
- **Socket.IO Client** – Real-time communication  

---

### ⚙️ Backend
- **Node.js + Express** – REST APIs & server logic  
- **Socket.IO** – Real-time bidirectional communication  
- **OpenAI Whisper (ASR)** – Speech-to-text transcription  
- **Custom Transcription Agent** – PCM → WAV → ASR pipeline  
- **Prisma ORM** – Database access layer  
- **JWT Authentication** – Secure user sessions  

---

### 🗄️ Database
- **PostgreSQL / SQLite** – User, session & message storage  

---

### ☁️ Infrastructure & Tools
- **WebSockets** – Low-latency audio streaming  
- **REST APIs** – Auth, sessions, summaries  
- **Vite Dev Server** – Fast local development  
- **Git & GitHub** – Version control  

---

## 📂 Project Structure (Simplified)

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

yaml
Copy code

---

## ⚠️ Assumptions Made
- Users grant microphone access in the browser  
- Stable internet connection for real-time streaming  
- OpenAI API key is configured in production  
- Conferences are short-to-medium duration  
- One primary speaker at a time (basic ASR setup)  
- WebSocket connections are authenticated after login  

---

## 🧪 Limitations
- No video streaming (audio-only conferences)  
- Basic speaker identification (no diarization)  
- Mock transcription used if API key is missing  
- No session recording playback (live only)  

---

---

## 🚀 Running the Project Locally

### 🔧 Backend Setup

```bash
cd backend
npm install
npm run dev

---

---


🎨 Frontend Setup
cd frontend
npm install
npm run dev

🔑 Environment Variables

Create a .env file in the backend directory:

OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

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



