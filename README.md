<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# QuantCore Pro

A professional-grade quantitative trading terminal built with Electron + React + TypeScript + Python.

## Features

- **Real-Time Market Data** — Live crypto prices via Binance WebSocket; A-share stock data via browser-compatible adapters (EastMoney, Tencent, Sina)
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
│   ├── App.tsx             # Root coordinator (thin — wires hooks → views)
│   ├── types.ts            # Shared TypeScript interfaces & enums
│   ├── constants/
│   │   └── resources.ts        # i18n strings (EN/CN)
│   ├── components/
│   │   ├── ui/                 # Modal, Panel, CommandBar, Toast, NavIcon, OrderTicket
│   │   ├── MarketChart.tsx     # Zoomable price chart (Recharts)
│   │   ├── OrderBook.tsx       # L2 depth visualization
│   │   └── StrategyEditor.tsx  # Monaco IDE + AI copilot
│   ├── hooks/
│   │   ├── useMarketData.ts    # Binance/stock polling + WebSocket
│   │   ├── useWatchlist.ts     # Watchlist add/remove
│   │   ├── useNotifications.ts # Toast notifications
│   │   ├── useStrategyFiles.ts # Strategy file CRUD
│   │   └── useBacktest.ts      # Backtest engine
│   ├── services/
│   │   ├── crypto/             # binanceRestService, binanceWsService
│   │   ├── stock/              # adapters: EastMoney (default), Tencent, Sina
│   │   └── ai/                 # geminiService (news, strategy gen)
│   ├── views/
│   │   ├── DashboardView.tsx   # F1 — watchlist + chart + portfolio
│   │   ├── MarketView.tsx      # F2 — full-screen chart + depth
│   │   ├── BacktestView.tsx    # F4 — equity curve + trade log
│   │   ├── NewsView.tsx        # F5 — AI news feed
│   │   ├── ScannerView.tsx     # F6 — market scanner
│   │   └── SettingsView.tsx    # Settings panel
│   └── utils/
│       └── technicalIndicators.ts # SMA calculations
└── python/                 # Python backend (Flask + Socket.IO, health-check only)
    ├── main.py             # /health endpoint + Socket.IO stub (port 5000)
    └── requirements.txt    # flask, flask-cors, flask-socketio, eventlet
```

## Prerequisites

- **Node.js** ≥ 18 and **pnpm** ≥ 9 (`npm i -g pnpm`)
- A **Gemini API key** (for AI news & strategy features)

## Quick Start — Web Dev Mode (Vite only)

```bash
# Install Node dependencies
pnpm install

# Create .env.local and add your key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start the Vite dev server
pnpm dev
# → http://localhost:5173
```

> In this mode crypto features (Binance) and AI features (Gemini) work fully.
> A-share stock data is fetched directly from browser-compatible adapters — no Python backend needed.

## Python Backend (Optional — Socket.IO Infrastructure)

The Python backend is only needed for real-time Socket.IO quote streaming. A-share data for
charts and watchlists is fetched directly by the frontend adapters.

```bash
cd python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
# → http://localhost:5000/health
```

## Electron Desktop App

```bash
# Compile Electron TypeScript and start with hot-reload
pnpm electron:dev
```

Requires the Vite dev server to be running.

## Production Build

```bash
pnpm electron:build
# → ./release/
```

To bundle the Python backend as a standalone executable:
```bash
pnpm compile:python
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
| Shell        | Electron 42                                 |
| Frontend     | React 19, TypeScript 6, Vite 8, Tailwind CSS|
| Charts       | Recharts 3                                  |
| Code Editor  | Monaco Editor (`@monaco-editor/react`)      |
| Icons        | Lucide React                                |
| AI           | Google Gemini (`@google/genai`)             |
| Crypto Data  | Binance REST + WebSocket APIs               |
| Stock Data   | EastMoney / Tencent / Sina (browser-direct) |
