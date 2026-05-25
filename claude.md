# QuantCore Pro — Claude Code Index

This file is the initial index for Claude Code (claude.ai/code) to understand the project at a glance.

---

## Project Summary

QuantCore Pro is a **professional quantitative trading terminal** packaged as an Electron desktop app. It provides:

- Real-time cryptocurrency market data (Binance)
- Real-time A-share (Chinese stock market) data (browser-compatible adapters: 腾讯财经, 东方财富, 新浪财经; BaoStock via Python backend)
- **Sector/concept board analytics (题材聚焦/题材轮动)** — API-driven industry & concept board rankings via EastMoney
- **Multi-adapter data source system** — multiple adapters can serve different data capabilities simultaneously
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
│   │   ├── StrategyEditor.tsx   ← Monaco IDE + AI Copilot panel + file explorer
│   │   └── ui/
│   │       └── ConfirmDialog.tsx ← Unified confirmation dialog (replaces window.confirm)
│   │
│   ├── hooks/
│   │   └── useSectorBoards.ts   ← Hook for sector/concept board data with polling & drill-down
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
│   │       ├── IStockDataAdapter.ts ← Adapter interface + AdapterMeta + AdapterCapability
│   │       ├── adapters/
│   │       │   ├── TencentAdapter.ts       ← 腾讯财经 (FREE, browser-compatible)
│   │       │   ├── SinaAdapter.ts          ← 新浪财经 (FREE, Electron/proxy required)
│   │       │   ├── EastMoneyAdapter.ts     ← 东方财富 (FREE, browser-compatible, default)
│   │       │   └── BaoStockAdapter.ts      ← BaoStock (FREE, requires Python backend)
│   │       ├── sectorBoardService.ts ← EastMoney API for concept/industry board data (题材聚焦)
│   │       ├── stockDataService.ts  ← Adapter registry + multi-adapter routing + public API
│   │       └── stockWsService.ts    ← Socket.IO client for Python backend real-time quotes
│   │
│   └── utils/
│       └── technicalIndicators.ts   ← calculateSMA, enhanceCandlesWithIndicators (MA7/25/99)
│
└── python/                 ← Python backend (Flask + Socket.IO, health-check + WS infra + BaoStock + boards)
    ├── main.py             ← Flask app; /health endpoint + Socket.IO events; runs on port 5000
    ├── baostock_routes.py  ← BaoStock REST endpoints (snapshot, klines/daily, klines/minute)
    ├── board_routes.py     ← Sector board endpoints via BaoStock (industry boards, board stocks, performance)
    └── requirements.txt    ← flask, flask-cors, flask-socketio, eventlet, baostock, pyinstaller
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
- Endpoints: `/health`, `/api/baostock/*`, `/api/boards/*`
- Socket.IO events: `connect`, `disconnect`, `subscribe`, `unsubscribe`, `quote_update`
- Symbol format: `sh600519` (Shanghai) / `sz000858` (Shenzhen)
- Board endpoints: `/api/boards/industry`, `/api/boards/stocks`, `/api/boards/stock-performance`

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

**Multi-adapter mode**: Enable via `stockDataService.setMultiAdapterMode(true)` to route different data capabilities (realtime, dailyKlines, minuteKlines) to different adapters simultaneously. Configure per-capability adapter via `stockDataService.setCapabilityAdapter(capability, adapterId)`.

| ID | Name | 费用 | Browser | Capabilities | Notes |
|----|------|------|---------|-------------|-------|
| `eastmoney` | 东方财富 | 免费 | ✅ | realtime, dailyKlines, minuteKlines | **Default.** Supports qfq/hfq. Also serves sector board data. |
| `tencent` | 腾讯财经 | 免费 | ✅ | realtime, dailyKlines, minuteKlines | Reliable. CORS-permissive. No price adjustment for historical klines. |
| `sina` | 新浪财经 | 免费 | ⚠️ Electron/proxy | realtime, dailyKlines | Real-time endpoint lacks CORS headers. |
| `baostock` | BaoStock | 免费 | ❌ | dailyKlines, minuteKlines | Requires the local Python backend (`python/baostock_routes.py`). |

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

A-Share:  Multi-Adapter System (EastMoney/Tencent/Sina/BaoStock — capability-routed)
            └─ stockDataService.fetchStockTickers() ──────► App.tsx (watchlist, scanner)
            └─ stockDataService.fetchStockKlines()  ──────► App.tsx (chart)
          Sector Boards (EastMoney Push API) ────────────► MarketView BOARDS tab (题材聚焦)
          Python Socket.IO ────────────────────────────────► stockWsService → (available for real-time)
          Python Board Routes ────────────────────────────► BaoStock industry/concept boards (server-side)

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
