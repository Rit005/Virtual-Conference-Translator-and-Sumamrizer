🎤 Virtual Conference Translator & Summarizer

A full-stack web application that enables real-time virtual conferences with live speech-to-text captions, multi-language support, chat/Q&A, and AI-generated summaries using modern web and AI technologies.

📌 Features

🔐 Authentication

Email & password login with JWT

OAuth login using Google and GitHub

Role-based access: Viewer, Host, Moderator

Email verification for new users

🎙️ Live Audio Streaming

Browser microphone capture

Real-time audio streaming via WebSockets

PCM → WAV conversion for ASR processing

📝 Live Captions

Real-time speech-to-text using OpenAI Whisper

Displays captions during the conference

Supports multiple languages

💬 Chat & Q&A Panel

Real-time chat between participants

Typing indicators

Session-scoped messages

📄 Session Summary

AI-generated summary after the conference ends

Key discussion points extraction (extensible)

🌐 Scalable Architecture

REST APIs + WebSockets

Dockerized backend, frontend, and database

PostgreSQL with Prisma ORM

🧠 Architecture Overview
Frontend (React + Vite)

React 18 with Context API

Tailwind CSS for UI

Socket.IO client for real-time communication

Audio capture via Web Audio API

Role-based UI rendering

Backend (Node.js + Express)

REST APIs for auth, sessions, summaries

WebSocket server using Socket.IO

Audio processing pipeline

Whisper ASR integration

JWT authentication & middleware

AI / Audio Layer

OpenAI Whisper API for speech-to-text

Audio buffering & chunking

PCM → WAV conversion

Transcription agent for controlled batching

Database (PostgreSQL)

Prisma ORM

User management

Conference sessions

Roles & permissions

Chat logs & summaries

🗂️ Project Structure
frontend/
 ├─ components/
 ├─ contexts/
 ├─ hooks/
 ├─ services/
 ├─ pages/
 └─ App.jsx

backend/
 ├─ controllers/
 ├─ routes/
 ├─ agents/
 ├─ services/
 ├─ socket/
 ├─ utils/
 └─ server.js

docker-compose.yml

🔑 Roles & Permissions
Role	Permissions
Viewer	Join session, view captions, chat
Moderator	Manage chat, assist host
Host	Start/end conference, generate summary
⚙️ Implementation Choices

WebSockets (Socket.IO) chosen for low-latency real-time communication

Whisper ASR selected for high-accuracy speech recognition

JWT authentication for stateless and scalable auth

Email verification to ensure valid users

Docker for environment consistency and easy deployment

Prisma ORM for type-safe database access

Context API instead of Redux for simplicity

🧪 Assumptions Made

Users have a modern browser with microphone access

Internet connection is stable during live sessions

OpenAI API key is available for real transcription

One primary speaker audio stream at a time (can be extended)

Email service (SMTP) is properly configured

Live captions accuracy depends on audio quality

🚀 How to Run the Project
1️⃣ Clone the repository
git clone <repo-url>
cd virtual-conference-translator

2️⃣ Setup Environment Variables

Create .env files for backend and frontend.

Backend (.env):

PORT=3001
DATABASE_URL=postgresql://user:password@db:5432/conference
JWT_SECRET=your_secret
OPENAI_API_KEY=your_key
SMTP_USER=your_email
SMTP_PASS=app_password
FRONTEND_URL=http://localhost:5173

3️⃣ Run with Docker
docker compose up --build

4️⃣ Access the App

Frontend: http://localhost:5173

Backend: http://localhost:3001

📈 Future Enhancements

Speaker diarization (multiple speakers)

Noise suppression & echo cancellation

Live translation between languages

Recording & playback

Admin dashboard & analytics

Cloud deployment (AWS / Azure)

👨‍💻 Author

Rithik Sharma
Full Stack Developer | AI-Driven Web Applications
