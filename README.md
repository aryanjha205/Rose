# 🌸 WebCall - Production-Ready Real-Time Voice & Video Calling

**WebCall** is a full-featured, real-time voice and video communication application built with **Python 3.12+**, **Flask**, **Flask-SocketIO**, **Vanilla JavaScript (ES6+)**, **WebRTC**, **Bootstrap 5**, **Neon Serverless PostgreSQL**, **SQLAlchemy**, **Alembic**, **JWT Authentication**, **bcrypt**, and **Cloudinary**.

The entire application is crafted with a signature **Pink + White visual identity** featuring smooth transitions, animated call rings, real-time audio waveform visualizers, picture-in-picture video, and full mobile responsiveness.

---

## 🎨 Visual Identity & Design System

The application strictly adheres to the signature **Pink + White visual identity**:
- **Primary Pink**: `#FF4F9A`
- **Deep Pink**: `#F72585`
- **Soft Pink**: `#FFE4EF`
- **Light Pink**: `#FFF1F6`
- **Pure White**: `#FFFFFF`
- **Background**: `#FFF9FC`
- **Dark Text**: `#29212A`
- **Secondary Text**: `#8A7D88`
- **Status Green**: `#10B981` (Online indicators, Call accept)
- **Status Red**: `#EF4444` (End call, Declined, Missed calls)

---

## ✨ Features

1. **Username-Based Discovery**:
   - Every user registers with a permanent, unique `@username`.
   - Instant search with live debouncing to find users by username or display name without requiring a phone number.
   - User profile cards displaying display names, bio, avatars, and live online/offline indicators.
2. **Contact Management**:
   - Add contacts with custom nicknames or direct `@username` entry.
   - View contact lists with real-time presence indicators.
   - One-click Voice Call and Video Call buttons.
3. **Real-Time WebRTC Calling**:
   - One-to-one voice calls and video calls.
   - Flask-SocketIO signaling (SDP offers/answers, ICE candidate exchanges).
   - Google public STUN servers for NAT/firewall traversal across devices and networks.
   - Automated 30-second unanswered call timeout.
   - Self-call prevention and busy-state detection.
4. **Interactive Call Interfaces**:
   - **Incoming Call Screen**: Animated pink ripple pulses, caller avatar, caller name, call type badge, accept (green) and decline (red) buttons.
   - **Outgoing Call Screen**: Realistic PBX dialing tone, recipient avatar, cancel button.
   - **Active Voice Call Screen**: Call duration counter, remote avatar, and **real-time audio waveform visualizer** powered by Web Audio API `AnalyserNode`.
   - **Active Video Call Screen**: Fullscreen remote video viewport, floating picture-in-picture local camera preview, camera flip toggle (front/back camera), mic mute/unmute, camera on/off with placeholder, and fullscreen mode.
5. **Call History & Missed Calls**:
   - Complete logging of all calls: incoming, outgoing, missed, rejected, cancelled.
   - Exact call duration, formatted timestamps, and one-click "Call Again" action.
   - Dedicated Missed Calls view with notification badges.
6. **Procedural Web Audio API Sound Synthesizer**:
   - Synthetic melodic ringtone for incoming calls.
   - Synthetic dual-frequency PBX dial tone for outgoing calls.
   - Call connected and call end chimes.
7. **Cloudinary Avatar Uploads & Neon PostgreSQL**:
   - Avatars uploaded to Cloudinary with secure URL storage.
   - Neon Serverless PostgreSQL with SSL connection support, connection pooling, and Alembic database migrations.

---

## 📁 Project Architecture

```
call/
├── backend/
│   ├── __init__.py
│   ├── app.py                 # Flask app factory, static SPA serving, route registration
│   ├── config.py              # Environment configuration (Neon DB, Cloudinary, JWT, ICE)
│   ├── database.py            # SQLAlchemy & Flask-Migrate instances
│   ├── models/
│   │   ├── user.py            # User model (auth, password hashing, avatar URL, online presence)
│   │   ├── contact.py         # Contact relationships and nicknames
│   │   └── call_log.py        # Call history (caller, receiver, duration, status, timestamps)
│   ├── routes/
│   │   ├── auth.py            # /api/auth (register, login, get current user)
│   │   ├── users.py           # /api/users (search, public profiles, avatar upload, password)
│   │   ├── contacts.py        # /api/contacts (list, add, remove contacts)
│   │   └── calls.py           # /api/calls (recent, missed calls, stats)
│   ├── sockets/
│   │   ├── presence.py        # Online/offline presence sync & socket mappings
│   │   └── signaling.py       # WebRTC signaling, 30s call timeouts, call state
│   └── services/
│       ├── auth_service.py    # JWT encode/decode, token verification decorator
│       └── cloudinary_service.py # Cloudinary upload with secure URLs & fallback
├── frontend/
│   ├── index.html             # Single-Page Application container
│   ├── css/
│   │   ├── variables.css      # Pink + White CSS custom properties
│   │   ├── main.css           # Layouts, desktop sidebar, mobile header & nav
│   │   ├── components.css     # Buttons, cards, inputs, toasts, skeleton loaders
│   │   └── call.css           # Call overlays, radar wave ripples, waveform, PiP video
│   └── js/
│       ├── config.js          # Backend URL & STUN/TURN ICE servers configuration
│       ├── api.js             # Fetch wrapper with JWT headers & error handling
│       ├── auth.js            # Auth store & token management
│       ├── audio.js           # Web Audio API synthesizers & waveform analyzer
│       ├── socket.js          # Socket.IO connection & signaling dispatcher
│       ├── webrtc.js          # RTCPeerConnection manager, streams, camera flip
│       ├── ui.js              # View switcher, dynamic renders, toasts, call screens
│       └── app.js             # Bootstrap, router, and event listeners
├── migrations/                # Alembic database migrations
├── requirements.txt           # Python dependencies
├── render.yaml                # Render Infrastructure-as-Code blueprint
├── .env.example               # Template environment variables
├── run.py                     # Entry point for development and production runners
└── README.md                  # Comprehensive guide
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Python 3.12+
- A modern browser (Chrome, Edge, Firefox, Safari) with WebRTC support.

### 2. Clone & Install Dependencies
```bash
# Clone the repository
cd call

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your configuration:
- `DATABASE_URL`: Your Neon PostgreSQL connection string (defaults to local SQLite if omitted).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: (Optional for cloud avatar storage).

### 4. Run Migrations & Start the Server
```bash
flask db upgrade
python run.py
```
Open **`http://localhost:5000`** in your browser.

---

## 🧪 Testing Between Two Accounts (Two-Browser Walkthrough)

To verify real-time voice, video, signaling, and presence:

1. **Open User A (e.g. Regular Browser)**:
   - Go to `http://localhost:5000`.
   - Click **"Create one free"** and sign up:
     - Username: `alice`
     - Display Name: `Alice Walker`
     - Email: `alice@webcall.com`
     - Password: `password123`
   - You will land on Alice's Dashboard.

2. **Open User B (e.g. Incognito / Second Browser / Mobile Device)**:
   - Open an Incognito window or another browser (or connect from another device on the same network to `http://<YOUR_LOCAL_IP>:5000`).
   - Click **"Create one free"** and sign up:
     - Username: `bob`
     - Display Name: `Bob Miller`
     - Email: `bob@webcall.com`
     - Password: `password123`
   - You will land on Bob's Dashboard.

3. **Verify Presence & Search**:
   - In Bob's window, navigate to **Find Users**.
   - Search for `alice`.
   - Notice Alice's card with a **green online indicator**.
   - Click **Add** to add Alice to contacts.

4. **Test Voice Call**:
   - In Bob's window, click the **Voice Call** button (phone icon) on Alice's card.
   - Bob's screen switches to the outgoing calling screen with PBX dial tones.
   - Alice's screen immediately shows the pink incoming call modal with animated ripples and melodic chime.
   - Click **Accept** on Alice's screen.
   - The active voice call interface opens on both sides, displaying live duration counters and the dynamic Web Audio waveform visualizer.
   - Test mute/unmute and click **End Call**.

5. **Test Video Call & Camera Controls**:
   - Click the **Video Call** button.
   - Both users see video streams with picture-in-picture local camera previews.
   - Test camera toggle (on/off) and camera flip on mobile.
   - Click **End Call**.

6. **Test 30-Second Unanswered Timeout**:
   - Start a call from Bob to Alice and do not answer.
   - After 30 seconds, the call automatically times out, plays the call end tone, and logs as a **Missed Call** in Alice's **Missed Calls** view with badge counters updated.

---

## ☁️ Neon Serverless PostgreSQL Configuration

1. Create a free database at [Neon](https://neon.tech).
2. Copy your connection string from the Neon dashboard:
   ```
   postgresql://user:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Set `DATABASE_URL` in your `.env` or Render environment settings.
4. Run migrations:
   ```bash
   flask db upgrade
   ```

---

## ☁️ Cloudinary Configuration

1. Sign up for a free account at [Cloudinary](https://cloudinary.com).
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary dashboard.
3. Set the environment variables:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
4. Avatars will automatically be cropped, optimized, and saved to Cloudinary.

---

## 🌐 Render Deployment Guide

### Option A: Unified Web Service (Recommended & Simplest)
Because WebCall's Flask backend automatically serves the frontend static SPA at the root URL, you can deploy the complete platform in a single Render Web Service:
1. Create a new **Web Service** on Render connected to this repository.
2. Build Command: `pip install -r requirements.txt && flask db upgrade`
3. Start Command: `gunicorn --worker-class simple_websocket.gunicorn.GunicornWebsocketWorker -w 1 --bind 0.0.0.0:$PORT run:app`
4. Add Environment Variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `SECRET_KEY`: Random 32+ character string.
   - `JWT_SECRET_KEY`: Random 32+ character string.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### Option B: Decoupled Deployments (render.yaml Blueprint)
Deploy backend as a Web Service and frontend as a Static Site using the provided `render.yaml`:
1. Push this repository to GitHub.
2. In Render Dashboard, select **Blueprints** -> **New Blueprint Instance**.
3. Select this repository; Render will automatically detect `render.yaml` and configure both services.
4. Set the `WEBCALL_BACKEND_URL` environment variable on the Static Site to point to your Web Service URL.

---

## 🔒 Security & Best Practices

- **Password Security**: Passwords hashed using `bcrypt` with unique salts.
- **Authentication**: Stateless HMAC-SHA256 JWT tokens with 7-day expiration.
- **WebRTC Privacy**: Media streams are transmitted peer-to-peer with DTLS-SRTP end-to-end encryption.
- **Access Control**: Validates caller identities, blocks self-calling, prevents unauthorized call terminations, and ensures sensitive credentials are never sent to frontend clients.
