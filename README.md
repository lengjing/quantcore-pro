<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# QuantCore Pro

A professional-grade quantitative trading terminal built with Electron + React + TypeScript + Python.

## Features

- **Real-Time Market Data** — Live crypto prices via Binance WebSocket; A-share stock data via Python/akshare backend
- **Interactive Charts** — Candlestick-style line chart with zoom/pan, MA7/MA25/MA99 overlays
- **L2 Order Book** — Real-time bid/ask depth visualization
- **Time & Sales** — Live trade tape for crypto pairs
- **Quant IDE** — Monaco-powered code editor with AI strategy generation (Gemini)
- **Backtesting** — Strategy backtest runner with equity curve and performance metrics
- **Market Scanner** — Watchlist with live price/change streaming
- **News Wire** — AI-powered news feed with sentiment analysis (Gemini + Google Search)
- **Multi-language UI** — English / 中文 toggle

## Architecture

```
quantcore-pro/
├── index.html              # App entry (Vite + Tailwind CDN)
├── index.css               # Global style overrides
├── vite.config.ts          # Vite build config
├── tsconfig.json           # TypeScript config (frontend)
├── electron.d.ts           # Electron IPC type declarations
├── electron/               # Electron main process
│   ├── main.ts             # BrowserWindow + Python subprocess
│   ├── preload.ts          # contextBridge IPC bridge
│   └── tsconfig.json       # TypeScript config (electron)
├── src/                    # React frontend
│   ├── index.tsx           # React DOM entry
│   ├── App.tsx             # Root component (all views/state)
│   ├── types.ts            # Shared TypeScript interfaces & enums
│   ├── components/
│   │   ├── MarketChart.tsx     # Zoomable price chart (Recharts)
│   │   ├── OrderBook.tsx       # L2 depth visualization
│   │   └── StrategyEditor.tsx  # Monaco IDE + AI copilot
│   ├── services/
│   │   ├── binanceService.ts      # Binance REST API (klines, depth, tickers)
│   │   ├── websocketService.ts    # Binance WebSocket (aggTrade, depth20)
│   │   ├── stockService.ts        # A-share REST API via Python backend
│   │   ├── stockWebSocketService.ts # A-share realtime via Socket.IO
│   │   └── geminiService.ts       # Gemini AI (news, strategy gen, metrics)
│   └── utils/
│       └── technicalIndicators.ts # SMA calculations
└── python/                 # Python backend (Flask + akshare)
    ├── main.py             # Flask REST + Socket.IO server (port 5000)
    └── requirements.txt    # Python dependencies
```

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10 (for A-share stock data features)
- A **Gemini API key** (for AI news & strategy features)

## Quick Start — Web Dev Mode (Vite only)

```bash
# Install Node dependencies
npm install

# Create .env.local and add your key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start the Vite dev server
npm run dev
# → http://localhost:5173
```

> In this mode the crypto features (Binance) and AI features (Gemini) work fully.
> Stock (A-share) data requires the Python backend to be running (see below).

## Python Backend (A-Share Data)

```bash
cd python

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
# → http://localhost:5000
```

## Electron Desktop App

```bash
# Compile Electron TypeScript and start with hot-reload
npm run electron:dev
```

Requires the Vite dev server AND the Python backend to both be running.

## Production Build

```bash
# Compile everything
npm run electron:build
# → ./release/
```

To include the Python backend as a standalone executable:
```bash
npm run compile:python
# → ./python_dist/main
```

## Environment Variables

| Variable        | Description                   | Required |
|-----------------|-------------------------------|----------|
| `GEMINI_API_KEY`| Google Gemini API key         | For AI features |

Set in `.env.local` (never commit this file).

## Tech Stack

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| Shell        | Electron 39                                 |
| Frontend     | React 19, TypeScript, Vite 6, Tailwind CSS  |
| Charts       | Recharts 3                                  |
| Code Editor  | Monaco Editor (`@monaco-editor/react`)      |
| Icons        | Lucide React                                |
| AI           | Google Gemini (`@google/genai`)             |
| Crypto Data  | Binance REST + WebSocket APIs               |
| Stock Data   | Python / akshare + Flask + Socket.IO        |
