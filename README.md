# 📈 Real-Time Small Cap Stock Screener

A personal-use, real-time stock screener tailored for U.S. small-cap equities using the Alpaca Market Data API (IEX feed). It dynamically filters and streams only the most relevant tickers using key intraday trading metrics, including 5-min Relative Volume, Gap %, HOD breaks, and halt detection.

⚡ Built for premarket and intraday momentum scanning — inspired by Warrior Trading-style tools.

## 🚀 Features
Real-Time Trade Streaming via Alpaca's WebSocket (IEX feed)

5-Minute Relative Volume (RVOL) — Scans for current momentum vs historical volume

Gap % Filter — Measures open price vs prior close to detect gappers

Daily Relative Volume (10-day avg) — Filters for high-interest tickers

High of Day (HOD) Breaks — Highlights fresh breakout moves

Halt Detection & Resume Alerts — Flags stocks resuming after a halt

Frontend Table UI (React + Tailwind) that updates instantly via Socket.IO

Symbol auto-refresh every minute — stays dynamic without page reload

## 🛠 Tech Stack
Layer	Technology
Backend	Node.js, Express.js, Alpaca API, Socket.IO, WebSocket
Frontend	React.js, Tailwind CSS, Vite
Data	Alpaca Market Data (IEX feed)
Realtime	WebSocket (Alpaca) + Socket.IO (client/server)
Scheduling	setTimeout() loop for per-minute scanning
Others	dotenv, p-limit (concurrency limiter)

## 📦 Installation & Setup
⚠️ Alpaca API (free) account required.

1. Clone this repo
```
git clone https://github.com/your-username/real-time-stock-screener.git
cd real-time-stock-screener
```
2. Install backend dependencies
```
cd server
npm install
```
3. Create .env file in server/
```
APCA_API_KEY_ID=your_key_here
APCA_API_SECRET_KEY=your_secret_here
```
4. Start the backend
```
node index.js
```
5. Install frontend dependencies & start
```
cd ../client
npm install
npm run dev
```
6. Open your browser
```
Visit http://localhost:5173
```
## 📸 Screenshot
![Screenshot (297)](https://github.com/user-attachments/assets/8005e084-839e-4a61-821a-4897d089845c)

![Screenshot (301)](https://github.com/user-attachments/assets/d7d2a526-3710-4909-ab73-7702cf99d846)

## 🧠 Architecture Overview
This screener uses a client-server WebSocket architecture:
```
market-screener/
├── client/     ← React app (frontend)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── counter.jsx  ← main component for displaying trades
│   │   └── style.css
│   └── index.html
│
└── server/     ← Node.js backend
    ├── index.js         ← Express + Socket.IO + Alpaca API logic
    ├── .env             ← Alpaca API keys
    └── package.json
    📈 Real-Time Small Cap Stock Screener
```
```
[ Alpaca API ]
     |
     |  (WebSocket OR REST)
     ↓
[ Node.js Backend (Express + Socket.IO) ]
     |
     |  (trade events)
     ↓
[ React Frontend (Vite + Tailwind) ]
     |
     ↓
[ Live Table with Trade Data ]
```
### 🧩 Backend (Node.js)
Connects to Alpaca WebSocket for real-time trade data

Every minute:

Fetches top U.S. tickers using snapshots

Computes:

5-min relative volume (rvol5min)

Gap % (today open vs yesterday close)

10-day average volume

Filters stocks based on trading strategy

Emits trade events to the frontend via Socket.IO

### 🧩 Frontend (React)
Connects via Socket.IO

Displays a real-time table of trades with:

Symbol, Price, Size

5-min % Change, 5-min RVOL, Daily RVOL, Volume, Gap %

Strategy tags (HOD Break, Halt Resume)

### 🧪 Example Filters Used
Price: $1–20

5-Min RVOL: ≥ 1.0

Daily RVOL: ≥ 1.0

Gap %: configurable

Momentum: 5-min % change positive

Premarket Volume: inferred from 5-min bars

## 🧠 HOW EACH PART WORKS
### 1. 📡 Alpaca Integration
WebSocket (v2/iex)
Connected during regular trading hours (9:30am–4:00pm ET)

Receives real-time trades from IEX exchange

Emits them to frontend over Socket.IO

REST Polling (Fallback)
Runs every 5 seconds to fetch the latest trade

Works even during pre-market and after-hours

Emits polled data to frontend as a simulated real-time feed

You’re currently using the REST polling approach for 24/7 updates.

### 2. 🧠 Backend (Node.js + Express + Socket.IO)
Handles API keys using a .env file securely

Connects to Alpaca API (WebSocket or REST)

Emits trade data to all connected users via Socket.IO

Accepts frontend connections from http://localhost:5173

Also logs key events like connection/authentication for debugging

### 3. ⚛️ Frontend (React + Vite + Tailwind)
Connects to backend via socket.io-client

Listens for trade events like:

```
{ S: 'TSLA', p: 180.52, s: 100, t: 'timestamp' }
```
Renders them into a live-updating table

Table shows: Symbol, Price, Size, and Timestamp


## 📎 Notes
Uses Alpaca's IEX feed (free, not SIP) — suitable for personal projects

Data starts at 8:00 AM ET (premarket); no full 4:00 AM coverage

Not intended for production use or financial decisions

## 🤝 Contribution Guidelines

We welcome contributions! If you’d like to improve this project:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m "Added new feature"`).
4. Push to your fork (`git push origin feature-branch`).
5. Open a Pull Request.

---

💡 *Built with ❤️ by Sparsh Sharma

🚀 **Happy Coding!**

