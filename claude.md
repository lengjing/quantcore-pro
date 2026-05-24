# QuantCore Pro — Claude Code Index

This file is the initial index for Claude Code (claude.ai/code) to understand the project at a glance.

---

## Project Summary

QuantCore Pro is a **professional quantitative trading terminal** packaged as an Electron desktop app. It provides:

- Real-time cryptocurrency market data (Binance)
- Real-time A-share (Chinese stock market) data (browser-compatible adapters: 腾讯财经, 东方财富, 新浪财经)
- AI-powered strategy generation and news feed (Google Gemini)
- Interactive charts, order book, time & sales
- Monaco-based code IDE for strategy development
- Backtesting visualizations

---

## Directory Map

```
/
├── index.html              ← Vite entry HTML; loads Tailwind CDN + /src/index.tsx
├── index.css               ← Minimal global CSS (Tailwind handles most styling)
├── vite.config.ts          ← Vite config; resolves @ alias to project root; exposes GEMINI_API_KEY
├── tsconfig.json           ← Frontend TypeScript config (target: ES2022, jsx: react-jsx)
├── electron.d.ts           ← Type declarations for window.electron IPC bridge
├── package.json            ← Scripts: dev, build, electron:dev, electron:build, compile:python
│
├── electron/               ← Electron main process (compiled to dist-electron/)
│   ├── main.ts             ← Creates BrowserWindow, spawns Python subprocess, IPC handlers
│   ├── preload.ts          ← contextBridge: exposes onPythonData, onPythonError, sendToPython
│   └── tsconfig.json       ← CommonJS target, outDir: ../dist-electron
│
├── src/                    ← React frontend (TypeScript + JSX)
│   ├── index.tsx           ← ReactDOM.createRoot entry; suppresses ResizeObserver errors
│   ├── App.tsx             ← Giant root component: all views, state management, data orchestration
│   ├── types.ts            ← All shared types: ViewState, MarketTicker, CandleData, Order, etc.
│   │
│   ├── components/
│   │   ├── MarketChart.tsx      ← lightweight-charts candlestick; native zoom/pan/scroll; MA7/25/99 + volume
│   │   ├── OrderBook.tsx        ← L2 bid/ask depth bars
│   │   └── StrategyEditor.tsx   ← Monaco IDE + AI Copilot panel + file explorer
│   │
│   ├── services/                ← Domain-organised service layer
│   │   │
│   │   ├── ai/
│   │   │   └── geminiService.ts     ← Gemini AI: generateStrategyCode, fetchMarketNews, explainMetrics
│   │   │
│   │   ├── crypto/
│   │   │   ├── binanceRestService.ts ← Binance REST (fetchTopTickers, fetchKlines, fetchDepth)
│   │   │   └── binanceWsService.ts   ← Binance WebSocket (aggTrade + depth20 streams)
│   │   │
│   │   └── stock/                   ← A-share market data — adapter pattern
│   │       ├── types.ts             ← StockSnapshot, StockKline, MinutePeriod, DailyPeriod
│   │       ├── IStockDataAdapter.ts ← Adapter interface + AdapterMeta
│   │       ├── adapters/
│   │       │   ├── TencentAdapter.ts       ← 腾讯财经 (FREE, browser-compatible)
│   │       │   ├── SinaAdapter.ts          ← 新浪财经 (FREE, Electron/proxy required)
│   │       │   └── EastMoneyAdapter.ts     ← 东方财富 (FREE, browser-compatible, default)
│   │       ├── stockDataService.ts  ← Adapter registry + public API (fetchStockTickers, fetchStockKlines)
│   │       └── stockWsService.ts    ← Socket.IO client for Python backend real-time quotes
│   │
│   └── utils/
│       └── technicalIndicators.ts   ← calculateSMA, enhanceCandlesWithIndicators (MA7/25/99)
│
└── python/                 ← Python backend (Flask + Socket.IO, health-check + WS infra)
    ├── main.py             ← Flask app; /health endpoint + Socket.IO events; runs on port 5000
    └── requirements.txt    ← flask, flask-cors, flask-socketio, eventlet, pyinstaller
```

---

## Key Conventions

### Frontend (React/TypeScript)
- **All imports are relative** within `src/`; no `@/` alias is used in source files
- State is centralized in `App.tsx` (single large component pattern)
- Tailwind CSS classes are used inline (loaded from CDN in `index.html`)
- Terminal/Bloomberg aesthetic: black backgrounds, amber accent (`#ff9900`), green success (`#00ff00`)
- Font: `JetBrains Mono` (mono), `Inter` (sans)

### Electron
- Main process: `electron/main.ts` → compiled to `dist-electron/main.js`
- Preload uses `contextBridge` — no `nodeIntegration`
- In dev: loads `http://localhost:5173`; in prod: loads `dist/index.html`
- Spawns `python/main.py` as a child process and waits for `/health` endpoint

### Python Backend
- Framework: Flask + Flask-SocketIO (eventlet async mode)
- Port: **5000**
- Endpoints: `/health`
- Socket.IO events: `connect`, `disconnect`, `subscribe`, `unsubscribe`, `quote_update`
- Symbol format: `sh600519` (Shanghai) / `sz000858` (Shenzhen)

---

## Development Commands

```bash
# Web frontend only (fastest)
pnpm dev                        # Vite dev server on :5173

# Electron full app
pnpm electron:dev               # Starts Vite + compiles electron/ + launches Electron

# Build
pnpm electron:build             # Compile electron/ + vite build + electron-builder → release/
pnpm compile:python             # PyInstaller → python_dist/main

# Python backend (separate terminal — optional, only needed for Socket.IO infra)
cd python && python main.py     # Flask server on :5000
```

---

## A-Share Data Adapters

Four adapters are registered in `src/services/stock/stockDataService.ts`. Switch at runtime via `stockDataService.setActiveAdapter(id)`.

| ID | Name | 费用 | Browser | Notes |
|----|------|------|---------|-------|
| `eastmoney` | 东方财富 | 免费 | ✅ | **Default.** Supports qfq/hfq. Comprehensive intraday + daily data. |
| `tencent` | 腾讯财经 | 免费 | ✅ | Reliable. CORS-permissive. No price adjustment for historical klines. |
| `sina` | 新浪财经 | 免费 | ⚠️ Electron/proxy | Real-time endpoint lacks CORS headers. Historical klines browser-accessible. |
| `baostock` | BaoStock | 免费 | ❌ | Requires the local Python backend (`python/baostock_routes.py`). |

---

## Environment Variables

```
GEMINI_API_KEY=...    # Required for AI features (news, strategy gen)
```

Place in `.env.local` (gitignored). Vite injects it as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

---

## Data Flow

```
Crypto:   Binance REST API ──────────────────────────────► App.tsx (tickers, klines, depth)
          Binance WebSocket ──────────────────────────────► App.tsx (live trades, depth updates)

A-Share:  Active Adapter (EastMoney/Tencent/Sina/BaoStock local backend)
            └─ stockDataService.fetchStockTickers() ──────► App.tsx (watchlist, scanner)
            └─ stockDataService.fetchStockKlines()  ──────► App.tsx (chart)
          Python Socket.IO ────────────────────────────────► stockWsService → (available for real-time)

AI:       Google Gemini API ────────────────────────────► geminiService → App.tsx / StrategyEditor
```

---

## Views (ViewState enum)

| View       | Key  | Description                                    |
|------------|------|------------------------------------------------|
| DASHBOARD  | F1   | Multi-panel overview: watchlist, chart, orders |
| MARKET     | F2   | Full-screen chart + order book                 |
| STRATEGY   | F3   | Monaco IDE + AI strategy generator             |
| BACKTEST   | F4   | Backtest runner + equity curve                 |
| NEWS       | F5   | AI news wire + sentiment                       |
| SCANNER    | F6   | Full market scanner / screener                 |
| SETTINGS   | —    | Configuration panel                            |

---

## Known Limitations / Notes

- A-share stock data is fetched directly from frontend adapters. BaoStock mode requires the local Python backend on port 5000
- Gemini AI features require a valid `GEMINI_API_KEY`
- The app degrades gracefully when either backend is unavailable (shows empty data)
- Monaco Editor is loaded from jsDelivr CDN in `StrategyEditor.tsx`
- No CSS preprocessor — all styles via Tailwind CDN utility classes or inline JSX
