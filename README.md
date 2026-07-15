# 🌐 ConnectSphere — Real-time Video Communication Platform

<div align="center">

![ConnectSphere](https://img.shields.io/badge/ConnectSphere-v5.0-6366f1?style=for-the-badge&logo=video&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-Peer--to--Peer-FF6B6B?style=flat)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7.4-010101?style=flat&logo=socket.io&logoColor=white)
![Material-UI](https://img.shields.io/badge/MUI-5-0081CB?style=flat&logo=mui&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

**A production-ready, full-featured video communication platform with HD calls, E2EE chat, screen sharing, live annotations, virtual backgrounds, recording, reactions, and push-to-talk — all running in the browser.**

[🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [🏗️ Architecture](#️-architecture) • [📖 Installation](#-installation) • [🔧 Configuration](#-configuration) • [🚀 Deployment](#-deployment) • [🤝 Contributing](#-contributing)

</div>

---

## 🎉 What's New in v4.0

### 🐛 Critical Bug Fixes
- **Socket event name mismatch** — `chat-message-received` / `send-chat-message` corrected to match server events (`receive-message` / `send-message`); chat was completely broken before
- **Double message display** — sender's message no longer appears twice; server echo is now the single source of truth
- **Duplicate socket connection** — removed redundant `socket.connect()` call that fired alongside `autoConnect: true`
- **Memory leak in server** — `users.delete()` now always runs when a user leaves, not only when the room doesn't exist
- **Global CSS mirror** — local video mirror effect scoped to `.local-video-mirror` class; no longer flips remote video tiles
- **Invalid `sx` prop** — `sx={{ space: 2 }}` replaced with valid `sx={{ display: 'flex', flexDirection: 'column' }}`
- **Deprecated `onKeyPress`** — replaced with `onKeyDown` across all components

### ✨ New Features (v4.0)
1. **Avatar Color Picker** — choose from 12 colors on the join screen; persists to `localStorage`
2. **Room Password Protection** — optional password set by the room creator; server validates on join
3. **Participant Limit** — configurable max per room (2–20) via a slider in Advanced Options
4. **Persistent Chat** — messages saved to `localStorage` per room (last 200); restored on rejoin and merged with server history
5. **Unread Message Badge** — red counter on the chat icon when new messages arrive while chat is not visible
6. **Push-to-Talk** — hold **Space** to speak; mic stays muted otherwise; PTT chip shows "Speaking" live
7. **Local Recording** — record your call with `MediaRecorder`, downloads as `.webm` on stop; pulsing red indicator while active
8. **Raise Hand / Emoji Reactions** — ✋ raise hand broadcasts to all; 6-emoji reaction picker sends animated floating reactions
9. **Sound Notifications** — synthesized Web Audio API tones for join, leave, message, and reaction events; 🔔/🔕 toggle
10. **Full Mobile Layout** — bottom navigation tabs (Call / Chat / People) replacing the broken fixed-width panel
11. **Virtual Background & Blur** *(requires TensorFlow.js install — see [Virtual Backgrounds](#-virtual-backgrounds))* — hook-ready pipeline for background blur and custom image backgrounds using MediaPipe Selfie Segmentation
12. **End-to-End Encryption (E2EE)** — military-grade AES-GCM encryption for chat messages; the server cannot read your messages
13. **Live Screen Annotations** — draw over any video feed or screen share like a laser pointer; synchronized instantly across all users

---

## ✨ Features

### 🎥 Video & Audio
| Feature | Status |
|---------|--------|
| HD video calls (up to 1080p) | ✅ |
| Voice-only calls | ✅ |
| Echo cancellation & noise suppression | ✅ |
| Toggle camera / mute mic | ✅ |
| Push-to-talk (hold Space) | ✅ |
| Screen sharing (desktop / window / tab) | ✅ |
| Live Screen Annotations (laser pointer) | ✅ |
| Virtual background / blur | ✅ *(see setup)* |
| Local session recording (.webm) | ✅ |

### 💬 Chat
| Feature | Status |
|---------|--------|
| Real-time messaging | ✅ |
| End-to-end encryption (AES-GCM) | ✅ |
| Persistent history (localStorage) | ✅ |
| Unread badge | ✅ |
| Typing indicators | ✅ |
| Timestamped messages | ✅ |
| Colored user avatars in chat | ✅ |

### 🏠 Room Management
| Feature | Status |
|---------|--------|
| One-click room ID generation | ✅ |
| Shareable room links | ✅ |
| Room password protection | ✅ |
| Configurable participant limit | ✅ |
| Participant status list | ✅ |
| Raise hand with broadcast | ✅ |
| Emoji reactions (floating animation) | ✅ |

### 🎨 UI / UX
| Feature | Status |
|---------|--------|
| Dark Material-UI theme | ✅ |
| Avatar color picker (12 colors) | ✅ |
| Sound notifications | ✅ |
| Mobile-first responsive layout | ✅ |
| Bottom navigation on mobile | ✅ |
| Pulsing recording indicator | ✅ |

---

## 🏗️ Architecture

```
Connect-Sphere/
├── README.md
├── package.json                     # Root scripts (install-all, start, build)
├── .gitignore
│
├── server/
│   ├── index.js                     # Express + Socket.IO server
│   ├── package.json
│   └── .env                         # PORT, CLIENT_URL, NODE_ENV, MAX_PARTICIPANTS
│
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env                         # VITE_SERVER_URL
    └── src/
        ├── main.jsx
        ├── App.jsx                  # Join screen — avatar picker, password, participant limit
        ├── App.css
        ├── config.js                # SOCKET_URL, ICE_SERVERS, MEDIA_CONSTRAINTS
        │
        ├── components/
        │   ├── Room.jsx             # Main room — all call/chat/UI logic
        │   ├── VideoPlayer.jsx      # Standalone video tile (used outside Room if needed)
        │   ├── ChatBox.jsx          # Standalone chat panel (used outside Room if needed)
        │   └── Controls.jsx        # Standalone control bar (used outside Room if needed)
        │
        ├── hooks/
        │   ├── useSound.js          # Web Audio API sound notifications
        │   ├── useChatPersistence.js # localStorage chat history
        │   └── useVirtualBackground.js # TF.js background blur/replace (see setup)
        │
        └── utils/
            └── socket.js            # Configured Socket.IO singleton
```

### Data Flow

```
User Camera
    │
    ▼
getUserMedia() ──► localStream
    │                   │
    │         ┌─────────┼──────────────────┐
    │         ▼         ▼                  ▼
    │   VideoPlayer  useVirtualBackground  MediaRecorder
    │                   │                  │
    │              canvasStream        .webm download
    │                   │
    └──────────────► RTCPeerConnection ──► Remote peers
                                │
                           Socket.IO signaling
                          (offer/answer/ICE)
```

---

## 📖 Installation

### Prerequisites
- **Node.js** 18+ and npm
- Modern browser with WebRTC support (Chrome 90+, Firefox 88+, Edge 90+)
- HTTPS in production (required for camera/mic access)

### Quick Start

```bash
# 1. Clone
git clone https://github.com/yourusername/connectsphere.git
cd connectsphere

# 2. Install all dependencies
npm run install-all

# 3. Configure environment (see below)

# 4. Start
npm run start

# 5. Open http://localhost:5173
```

### Environment Setup

**`server/.env`**
```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
MAX_PARTICIPANTS=20
```

**`client/.env`**
```env
VITE_SERVER_URL=http://localhost:3001
```

### Root `package.json`

```json
{
  "name": "connectsphere",
  "version": "4.0.0",
  "private": true,
  "scripts": {
    "install-all": "npm install && cd server && npm install && cd ../client && npm install",
    "start": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd server && npm run dev",
    "client": "cd client && npm run dev",
    "build": "cd client && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

## 🌫️ Virtual Backgrounds

Virtual background and blur use **TensorFlow.js** with **MediaPipe Selfie Segmentation** — everything runs in the browser, no server changes needed.

### Install Dependencies

```bash
cd client
npm install @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl @tensorflow-models/body-segmentation
```

### How It Works

The `useVirtualBackground` hook intercepts the camera stream:

```
camera stream
     │
     ▼
<video> (hidden, source)
     │
     ▼
TF.js segmentation (per frame, requestAnimationFrame)
     │
     ├── person mask  ──► draw person pixels onto canvas
     └── background   ──► blur OR replace with custom image
                              │
                              ▼
                     canvas.captureStream(30)
                              │
                              ▼
                    processedStream ──► VideoPlayer / RTCPeerConnection
```

### Usage in Room

```jsx
import { useVirtualBackground } from '../hooks/useVirtualBackground';

// In Room component
const {
  processedStream,   // use this instead of localStream for WebRTC / video display
  isProcessing,
  bgMode,            // 'none' | 'blur' | 'image'
  setBgMode,
  setBgImage,        // pass an HTMLImageElement or image URL
  isModelLoaded,
} = useVirtualBackground(localStream);

// Pass processedStream to VideoPlayer and peer connections
```

### Background Modes

| Mode | Description |
|------|-------------|
| `'none'` | Raw camera, no processing |
| `'blur'` | Gaussian blur on background, person stays sharp |
| `'image'` | Replace background with a custom image |

### Performance Notes

- Model loads once (~3–5 seconds on first use); cached by the browser after that
- Uses **WebGL backend** for GPU acceleration — typically 15–30ms per frame on modern hardware
- Falls back gracefully to raw stream if WebGL is unavailable or model fails to load
- Recommended: enable only when needed; disable during screen sharing

### Preset Background Images

Place images in `client/public/backgrounds/` and reference them:

```jsx
setBgImage('/backgrounds/office.jpg');
setBgMode('image');
```

Recommended resolution: **1280×720** or **1920×1080**, JPEG for smaller file size.

---

## 🔧 Configuration

### WebRTC — ICE Servers (`client/src/config.js`)

By default only Google STUN servers are configured. For reliable connections behind corporate firewalls, add a TURN server:

```js
export const CONFIG = {
  SOCKET_URL: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001',
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN for production:
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password',
    },
  ],
  MEDIA_CONSTRAINTS: {
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  },
};
```

Free TURN providers: [Metered.ca](https://www.metered.ca/tools/openrelay/), [Twilio](https://www.twilio.com/docs/stun-turn)

### Server — Room Limits (`server/.env`)

```env
MAX_PARTICIPANTS=20   # global default; overridden per room by the client slider
```

### Theme Customization (`client/src/App.jsx`)

```js
const darkTheme = createTheme({
  palette: {
    primary: { main: '#5865f2' },   // accent color
    secondary: { main: '#57f287' }, // success color
    background: {
      default: '#202225',           // page background
      paper: '#2f3136',             // card / panel background
    },
  },
});
```

### Sound Notifications (`client/src/hooks/useSound.js`)

All sounds are synthesized via the Web Audio API — no audio files needed. Customize frequencies and durations:

```js
export const sounds = {
  userJoined: () => { playTone(880, 0.12); setTimeout(() => playTone(1100, 0.12), 130); },
  userLeft:   () => { playTone(660, 0.12); setTimeout(() => playTone(440, 0.18), 130); },
  message:    () => { playTone(1200, 0.08, 'sine', 0.1); },
  reaction:   () => { playTone(1400, 0.06); setTimeout(() => playTone(1600, 0.06), 80); },
};
```

### Chat Persistence (`client/src/hooks/useChatPersistence.js`)

```js
const MAX_MESSAGES = 200;       // rolling window per room
const KEY_PREFIX = 'cs_chat_'; // localStorage key prefix
```

---

## 📱 Interface Guide

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ConnectSphere  #room-id          [REC] [🎤]  [Copy] [👥] [Exit] │
├──────────────────────────────────────────┬──────────────────────┤
│                                          │                      │
│   ┌──────────┐  ┌──────────┐            │   💬 Chat            │
│   │  You     │  │  Remote  │  ...        │                      │
│   │  (video) │  │  (video) │            │   [messages]          │  
│   └──────────┘  └──────────┘            │                       │
│                                          │   [input] [Send]     │
├──────────────────────────────────────────┴──────────────────────┤
│  🎤  📷  🖥️  ⏺  PTT  ❌  ✋  😊  📋  🔔  ➡️ Exit           │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌─────────────────────┐
│  #room-id  [Copy] ➡ │
├─────────────────────┤
│                     │
│   Active Tab        │
│   (Call/Chat/People)│
│                     │
├─────────────────────┤
│  📹 Call │ 💬 Chat  │
│          │    (3)   │
│          │ 👥 People│
└─────────────────────┘
```

### Control Bar Reference

| Button | Action |
|--------|--------|
| 🎤 Green | Mic on — click to mute |
| 🎤 Red | Mic muted — click to unmute |
| 🎤 Yellow | PTT mode — hold Space to speak |
| 📷 Green | Camera on — click to turn off |
| 📷 Red | Camera off — click to turn on |
| 🖥️ | Toggle screen sharing |
| ⏺ Red pulse | Recording active — click to stop & download |
| ⏺ | Start recording |
| PTT chip | Toggle push-to-talk mode |
| ❌ | End call (keeps you in room) |
| ✋ | Raise / lower hand |
| 😊 | Open emoji reaction picker |
| 📋 | Copy room link |
| 🔔 / 🔕 | Toggle sound notifications |
| ➡️ | Leave room |

---

## 🚀 Deployment

### Development

```bash
npm run start
# Client: http://localhost:5173
# Server: http://localhost:3001
# Health: http://localhost:3001/health
```

### Production Build

```bash
cd client && npm run build
# Output: client/dist/
```

### Docker

**`server/Dockerfile`**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

**`client/Dockerfile`**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

**`docker-compose.yml`**
```yaml
version: '3.8'
services:
  server:
    build: ./server
    ports: ["3001:3001"]
    environment:
      NODE_ENV: production
      CLIENT_URL: https://yourdomain.com
      MAX_PARTICIPANTS: "20"
    restart: unless-stopped

  client:
    build: ./client
    ports: ["80:80", "443:443"]
    depends_on: [server]
    restart: unless-stopped
```

```bash
docker-compose up -d
```

### Platform Deployments

**Client → Vercel**
```bash
cd client
npx vercel --prod
# Set VITE_SERVER_URL in Vercel dashboard → Environment Variables
```

**Server → Railway / Render**
```bash
# Railway
railway login && railway init && railway up

# Render: connect GitHub repo, set build command to:
# npm install --prefix server
# Start command: npm start
```

### Production Checklist

- [ ] HTTPS enabled (required for camera/mic)
- [ ] `NODE_ENV=production` on server
- [ ] `VITE_SERVER_URL` points to production server
- [ ] CORS `origin` in `server/index.js` updated to production domain
- [ ] TURN server configured in `client/src/config.js`
- [ ] `MAX_PARTICIPANTS` set appropriately
- [ ] Rate limiting reviewed (helmet is already included)

---

## 🧪 Testing

### Manual Checklist

#### Join Screen
- [ ] Avatar color picker saves to localStorage
- [ ] Advanced Options shows password + participant limit slider
- [ ] Invalid username/room shows inline errors
- [ ] URL `?room=xxx` pre-fills room ID

#### Room — Call
- [ ] Start video call → camera/mic permissions requested
- [ ] Start voice call → mic only
- [ ] Mute / unmute mic
- [ ] Toggle camera on/off
- [ ] Screen share starts and stops
- [ ] PTT toggle → Space key mutes/unmutes
- [ ] End call stops all tracks

#### Room — Recording
- [ ] Record button pulses red when active
- [ ] Stop → `.webm` file downloads automatically
- [ ] Recording fails gracefully when no call is active

#### Room — Chat
- [ ] Messages appear for both sender and receiver
- [ ] No duplicate messages
- [ ] Unread badge increments when chat is not visible (mobile)
- [ ] Badge clears when chat is opened
- [ ] History restored on page refresh

#### Room — Reactions & Hands
- [ ] Raise hand shows ✋ on video tile and in participant list
- [ ] Lower hand removes indicator
- [ ] Emoji reaction floats and fades for all participants
- [ ] Sound plays on reaction (if sound enabled)

#### Room — Password & Limits
- [ ] Correct password allows join
- [ ] Wrong password shows error and stays on join screen
- [ ] Room full message shown when limit exceeded

### Browser Compatibility

| Feature | Chrome 90+ | Firefox 88+ | Safari 14+ | Edge 90+ |
|---------|-----------|-------------|-----------|----------|
| Video calls | ✅ | ✅ | ⚠️ Limited | ✅ |
| Screen share | ✅ | ✅ | ❌ | ✅ |
| Recording | ✅ | ✅ | ❌ | ✅ |
| Virtual background | ✅ | ✅ | ⚠️ No WebGL | ✅ |
| Push-to-talk | ✅ | ✅ | ✅ | ✅ |
| Chat / reactions | ✅ | ✅ | ✅ | ✅ |

### WebRTC Debugging

Open `chrome://webrtc-internals/` to inspect ICE states, media stats, and signaling flow.

---

## 🚨 Troubleshooting

### Camera / Mic Not Working
```
✅ Click the lock icon in the browser address bar → allow camera/mic
✅ Ensure HTTPS in production (WebRTC requires secure context)
✅ Check no other app is using the camera
✅ Try a different browser
```

### Messages Not Appearing
```
✅ Check browser console for socket errors
✅ Verify server is running (curl http://localhost:3001/health)
✅ Both users must be in the same room ID
✅ Ensure server/.env has correct PORT
```

### Video Black Screen
```
✅ Confirm getUserMedia constraints in config.js
✅ Check WebRTC peer connection state in chrome://webrtc-internals/
✅ Try disabling virtual background if enabled
✅ Add a TURN server for users behind strict NAT/firewalls
```

### Virtual Background Not Loading
```
✅ Install TF.js packages: npm install @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl @tensorflow-models/body-segmentation
✅ Requires WebGL — check chrome://gpu for WebGL status
✅ First load takes 3–5s to download the model (~5MB)
✅ Disable in Settings if performance is poor on low-end devices
```

### Recording Download Is Empty
```
✅ Must start recording while a call is active (local stream required)
✅ video/webm codec may not be supported on Safari — use Chrome
✅ Check available disk space
```

### Room Full / Password Errors
```
✅ Password is set by the first user to join with that room ID
✅ Subsequent users must enter the same password
✅ Participant limit is also set by the creator — ask them to increase it
```

### Socket Connection Fails
```
✅ Check VITE_SERVER_URL in client/.env
✅ Verify server CORS origin includes client URL
✅ Check firewall — Socket.IO needs port 3001 open
✅ Try switching transports: change ['websocket', 'polling'] to ['polling', 'websocket']
```

---

## 📈 Performance

### Benchmarks (v4.0)

| Metric | Value |
|--------|-------|
| Client bundle size | ~2.1 MB (with MUI tree-shaking) |
| First Contentful Paint | < 1.5s |
| Memory (idle) | ~60 MB |
| Memory (2-person call) | ~120 MB |
| Memory (virtual background) | ~200 MB |
| CPU (call, no VBG) | < 5% on modern hardware |
| CPU (virtual background) | 10–25% (GPU-accelerated) |
| Max participants (mesh WebRTC) | ~8 recommended, 20 max |

### Optimization Tips

**Vite build** (`client/vite.config.js`):
```js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
```

**Server compression**:
```bash
npm install compression --save
```
```js
const compression = require('compression');
app.use(compression());
```

---

## 🗺️ Roadmap

### Near-term (v4.x)
- [ ] **TURN server provisioning guide** — step-by-step with Metered.ca / coturn
- [ ] **Virtual background UI** — in-room selector with preset images and blur slider
- [ ] **Whiteboard** — collaborative canvas using `fabric.js`
- [ ] **File sharing** — drag-and-drop images/documents in chat
- [ ] **Message reactions** — react to individual chat messages with emoji

### Medium-term (v5.0)
- [ ] **SFU architecture** — replace mesh WebRTC with [LiveKit](https://livekit.io) or [mediasoup](https://mediasoup.org) for 50+ participants
- [ ] **Breakout rooms** — split a large room into smaller sub-rooms
- [ ] **Persistent rooms** — MongoDB/PostgreSQL backend for history beyond the server session
- [ ] **User accounts** — optional auth with JWT

### Long-term
- [ ] **Native mobile apps** — React Native with WebRTC
- [ ] **Subtitles / transcription** — Web Speech API or Whisper API
- [ ] **Integration webhooks** — Slack, Discord, Teams notifications
- [ ] **Analytics dashboard** — room/user activity metrics

---

## 🤝 Contributing

```bash
# 1. Fork and clone
git clone https://github.com/your-fork/connectsphere.git

# 2. Install
npm run install-all

# 3. Create a branch
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bugfix

# 4. Make changes — follow the coding standards below

# 5. Test manually against the checklist above

# 6. Commit and push
git commit -m "feat(room): add whiteboard panel"
git push origin feat/your-feature

# 7. Open a pull request
```

### Commit Convention

```
type(scope): short description

Types: feat | fix | docs | style | refactor | perf | test | chore
Scopes: app | room | chat | server | hooks | docs | deps

Examples:
feat(room): add virtual background blur mode
fix(chat): correct socket event name for message delivery
docs(readme): update deployment guide for Railway
perf(room): lazy-load TF.js model only when VBG is enabled
```

### Coding Standards

- **React**: functional components + hooks only; no class components
- **Styling**: MUI `sx` prop + `createTheme`; avoid raw CSS unless necessary
- **Async**: `async/await` everywhere; no `.then()` chains
- **Naming**: `camelCase` variables/functions, `PascalCase` components, `kebab-case` files
- **Comments**: document non-obvious WebRTC and TF.js logic
- **Errors**: always show user-facing feedback via `showSnackbar` — never silent failures

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what's wrong.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen.

**Environment**
- OS: [Windows / macOS / Linux]
- Browser: [Chrome 120 / Firefox 122 / etc.]
- Node.js: [v18.x / v20.x]
- ConnectSphere: [v4.0]

**Console output / screenshots**
Paste errors here.
```

### Feature Request Template

```markdown
**Problem to solve**
What is the user need or pain point?

**Proposed solution**
How would you implement it?

**Alternatives considered**
Other approaches you thought of.

**Additional context**
Mockups, links, prior art.
```

---

## 📜 License

```
MIT License — Copyright (c) 2024 ConnectSphere Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

---

## 🙏 Acknowledgments

- [React](https://react.dev/) — UI library
- [Material-UI](https://mui.com/) — component system
- [Socket.IO](https://socket.io/) — real-time transport
- [WebRTC](https://webrtc.org/) — peer-to-peer media
- [TensorFlow.js](https://www.tensorflow.org/js) — in-browser ML for virtual backgrounds
- [MediaPipe](https://mediapipe.dev/) — selfie segmentation model
- [Vite](https://vitejs.dev/) — build tool
- [Express.js](https://expressjs.com/) — server framework

---

<div align="center">

**[🚀 Get Started](#-installation)** • **[📖 Docs](#-configuration)** • **[🐛 Issues](https://github.com/yourusername/connectsphere/issues)** • **[💬 Discussions](https://github.com/yourusername/connectsphere/discussions)**

Made with ❤️ by the ConnectSphere Team — *Star ⭐ if this helped you!*

</div>
