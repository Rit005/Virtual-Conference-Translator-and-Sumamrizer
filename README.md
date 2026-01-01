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

