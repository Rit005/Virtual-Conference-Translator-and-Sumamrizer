# 🎥 Virtual Conference Translator & Summarizer

A full-stack web application that enables **real-time virtual conferences** with **live speech-to-text captions**, **multi-language support**, **chat/Q&A**, and **AI-generated summaries** using modern web and AI technologies.

---

## 🚀 Features

### 🔐 Authentication
- Email & password login with JWT  
- OAuth login using Google and GitHub  
- Role-based access: **Viewer, Host, Moderator**  
- Email verification for new users  

### 🎤 Live Audio Streaming
- Browser microphone capture  
- Real-time audio streaming via WebSockets  
- PCM → WAV conversion for ASR processing  

### 📝 Live Captions
- Real-time speech-to-text captions  
- Multi-language support  
- Low-latency updates  

### 🤖 AI Summary
- Auto-generated meeting summary  
- Generated when the host ends a session  
- Useful for meeting notes & records  

### 💬 Chat & Q&A
- Real-time chat during conferences  
- Participant interaction and Q&A  

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

## 🚀 Running the Project Locally

### Backend Setup
```bash
cd backend
npm install
npm run dev
Frontend Setup
bash
Copy code
cd frontend
npm install
npm run dev
🔑 Environment Variables
Create a .env file in the backend directory:

env
Copy code
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
