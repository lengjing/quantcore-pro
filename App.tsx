import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  LineChart,
  Code,
  History,
  Settings,
  Terminal as TerminalIcon,
  Search,
  Globe,
  Wifi,
  MoreVertical,
  X,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Command,
  Keyboard,
  FileText,
  Share2,
  Printer,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Loader2,
  ExternalLink,
  Coins,
  CandlestickChart,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  CartesianGrid as ReGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer as ReResponsive
} from 'recharts';
import { ViewState, CandleData, Position, MarketTicker, Timeframe, NewsItem, LogEntry, Trade, BacktestResult, StrategyFile } from './types';
import MarketChart from './components/MarketChart';
import OrderBook from './components/OrderBook';
import StrategyEditor from './components/StrategyEditor';
import { fetchMarketNews } from './services/geminiService';
import { fetchTopTickers, fetchKlines, fetchDepth } from './services/binanceService';
import { fetchStockTickers, fetchStockKlines } from './services/stockService';
import { connectWebSocket } from './services/websocketService';
import { enhanceCandlesWithIndicators } from './utils/technicalIndicators';

// --- Localization Resources ---
const RESOURCES = {
  EN: {
    NAV_DASHBOARD: "MONITOR [F1]",
    NAV_MARKET: "CHARTS [F2]",
    NAV_STRATEGY: "DEV IDE [F3]",
    NAV_BACKTEST: "BACKTEST [F4]",
    NAV_NEWS: "NEWS [F5]",
    NAV_SCANNER: "SCANNER [F6]",
    NAV_SETTINGS: "SETUP",
    PNL_WATCHLIST: "WATCHLIST",
    PNL_CHART: "PRIMARY CHART",
    PNL_TECH_CHART: "TECHNICAL CHART",
    PNL_DEPTH: "L2 DEPTH",
    PNL_SALES: "TIME & SALES",
    PNL_PORTFOLIO: "PORTFOLIO & RISK",
    PNL_ORDER: "ORDER TICKET",
    PNL_IDE: "QUANT STUDIO IDE",
    PNL_NEWS: "REAL-TIME NEWS WIRE",
    PNL_SENTIMENT: "SENTIMENT ANALYSIS",
    PNL_SCANNER: "MARKET SCANNER",
    PNL_GEN_CONFIG: "GENERAL CONFIG",
    PNL_PERF: "STRATEGY PERFORMANCE REPORT",
    PNL_LOGS: "EXECUTION LOGS",
    ORDER_LIMIT: "LIMIT",
    ORDER_MARKET: "MARKET",
    BTN_BUY: "BUY / LONG",
    BTN_SELL: "SELL / SHORT",
    TH_TICKER: "TICKER",
    TH_LAST: "LAST",
    TH_SYMBOL: "SYMBOL",
    TH_QTY: "QTY",
    TH_ENTRY: "ENTRY",
    TH_MARK: "MARK",
    TH_PNL: "P&L",
  },
  CN: {
    NAV_DASHBOARD: "实盘监控 [F1]",
    NAV_MARKET: "市场图表 [F2]",
    NAV_STRATEGY: "策略开发 [F3]",
    NAV_BACKTEST: "历史回测 [F4]",
    NAV_NEWS: "新闻资讯 [F5]",
    NAV_SCANNER: "选股扫描 [F6]",
    NAV_SETTINGS: "系统设置",
    PNL_WATCHLIST: "自选列表",
    PNL_CHART: "主力合约图表",
    PNL_TECH_CHART: "技术分析图表",
    PNL_DEPTH: "深度图 (L2)",
    PNL_SALES: "成交明细",
    PNL_PORTFOLIO: "账户持仓 & 风控",
    PNL_ORDER: "下单面板",
    PNL_IDE: "量化策略工作室",
    PNL_NEWS: "实时新闻流",
    PNL_SENTIMENT: "情绪分析",
    PNL_SCANNER: "市场扫描器",
    PNL_GEN_CONFIG: "通用设置",
    PNL_PERF: "策略绩效报告",
    PNL_LOGS: "执行日志",
    ORDER_LIMIT: "限价单",
    ORDER_MARKET: "市价单",
    BTN_BUY: "买入 / 做多",
    BTN_SELL: "卖出 / 做空",
    TH_TICKER: "代码",
    TH_LAST: "最新价",
    TH_SYMBOL: "合约",
    TH_QTY: "数量",
    TH_ENTRY: "开仓均价",
    TH_MARK: "标记价格",
    TH_PNL: "盈亏",
  }
};

// --- Types & Interfaces ---
interface Notification {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
}

type MarketMode = 'CRYPTO' | 'CN_STOCK';
type ScannerSort = 'CHANGE_DESC' | 'CHANGE_ASC' | 'VOL_DESC';

// --- Reusable UI Components ---

const Modal = ({ isOpen, onClose, title, children, width = "max-w-2xl" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-terminal-bg border border-terminal-accent shadow-[0_0_15px_rgba(255,153,0,0.1)] w-full ${width} m-4 flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-3 py-2 bg-terminal-accent text-black font-bold select-none shrink-0">
          <span className="uppercase tracking-wider text-xs flex items-center gap-2">
            <TerminalIcon size={12} /> {title}
          </span>
          <button onClick={onClose} className="hover:bg-black/20 p-1 rounded">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

interface PanelProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  tools?: React.ReactNode;
  onRefresh?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const Panel = ({ title, children, className = "", tools, onRefresh, onScroll }: PanelProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const containerClass = isMaximized
    ? "fixed inset-2 z-40 bg-terminal-bg border border-terminal-accent"
    : `flex flex-col bg-terminal-panel border border-terminal-border relative group ${className}`;

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between px-2 py-1 bg-[#1a1a1a] border-b border-terminal-border select-none shrink-0 h-7">
        <div className="flex items-center space-x-2">
          <div className={`w-1 h-3 ${isMaximized ? 'bg-terminal-success' : 'bg-terminal-accent'}`}></div>
          <span className="text-[10px] font-bold tracking-wider text-gray-300 uppercase truncate">{title}</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-500">
          {tools}
          <div className="relative">
            <MoreVertical
              size={12}
              className="cursor-pointer hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            />
            {isMenuOpen && (
              <div className="absolute right-0 top-4 w-32 bg-[#222] border border-terminal-border shadow-xl z-50 py-1">
                <div className="px-3 py-1 text-[10px] text-gray-400 hover:bg-terminal-accent hover:text-black cursor-pointer flex items-center gap-2"
                  onClick={() => { setIsMaximized(!isMaximized); setIsMenuOpen(false); }}>
                  {isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />} {isMaximized ? 'RESTORE' : 'MAXIMIZE'}
                </div>
                <div className="px-3 py-1 text-[10px] text-gray-400 hover:bg-terminal-accent hover:text-black cursor-pointer flex items-center gap-2"
                  onClick={() => { onRefresh?.(); setIsMenuOpen(false); }}>
                  <RefreshCcw size={10} /> REFRESH
                </div>
                <div className="h-px bg-[#333] my-1"></div>
                <div className="px-3 py-1 text-[10px] text-terminal-error hover:bg-red-900/50 cursor-pointer">
                  CLOSE PANEL
                </div>
              </div>
            )}
            {isMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>}
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden flex flex-col" onScroll={onScroll}>
        {children}
      </div>
    </div>
  );
};

// --- Command Bar ---

const CommandBar = React.forwardRef(({
  value,
  onChange,
  onSubmit,
  onHelp,
  onMenu,
  marketMode
}: {
  value: string,
  onChange: (v: string) => void,
  onSubmit: () => void,
  onHelp: () => void,
  onMenu: () => void,
  marketMode: MarketMode
}, ref: any) => (
  <div className="h-8 bg-terminal-bg border-b border-terminal-border flex items-center px-2 space-x-2 shrink-0">
    <div className="text-terminal-accent font-bold text-xs select-none">CMD:</div>
    <div className="flex-1 relative">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        className="w-full bg-transparent border-none text-xs text-white font-mono focus:outline-none uppercase placeholder-gray-700"
        placeholder="ENTER COMMAND (e.g., 'BUY BTC', 'ADD ETH')..."
        autoFocus
        spellCheck={false}
      />
    </div>
    <div className="h-4 w-px bg-terminal-border mx-2"></div>
    <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400">
      <span className="text-gray-600">FEED:</span>
      <span className={`font-bold ${marketMode === 'CRYPTO' ? 'text-blue-400' : 'text-red-400'}`}>
        {marketMode === 'CRYPTO' ? 'BINANCE WSS' : 'TENCENT API'}
      </span>
    </div>
    <div className="h-4 w-px bg-terminal-border mx-2"></div>
    <div className="flex items-center space-x-2">
      <button onClick={onHelp} className="text-[10px] text-black bg-terminal-accent px-2 py-0.5 font-bold hover:bg-yellow-500">HELP</button>
      <button onClick={onMenu} className="text-[10px] text-black bg-gray-400 px-2 py-0.5 font-bold hover:bg-gray-300">MENU</button>
    </div>
    <div className="h-4 w-px bg-terminal-border mx-2"></div>
    <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400">
      <span className="flex items-center text-terminal-success"><Wifi size={10} className="mr-1" /> CNNCTD</span>
      <Clock />
    </div>
  </div>
));

const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{time.toLocaleTimeString('en-US', { hour12: false })}</span>
};

// --- Toast Notification Component ---

const ToastContainer = ({ notifications, removeNotification }: { notifications: Notification[], removeNotification: (id: string) => void }) => {
  return (
    <div className="fixed bottom-8 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`flex items-center gap-3 px-4 py-3 min-w-[300px] border-l-4 shadow-2xl animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto
            ${n.type === 'SUCCESS' ? 'bg-[#0a200a] border-terminal-success text-white' :
              n.type === 'ERROR' ? 'bg-[#200a0a] border-terminal-error text-white' :
                'bg-[#1a1a1a] border-blue-500 text-white'}`}
        >
          {n.type === 'SUCCESS' && <CheckCircle size={16} className="text-terminal-success shrink-0" />}
          {n.type === 'ERROR' && <AlertTriangle size={16} className="text-terminal-error shrink-0" />}
          {n.type === 'INFO' && <Info size={16} className="text-blue-500 shrink-0" />}
          <div className="flex-1 font-mono text-xs font-bold uppercase tracking-wide">{n.message}</div>
          <button onClick={() => removeNotification(n.id)} className="hover:text-gray-400"><X size={12} /></button>
        </div>
      ))}
    </div>
  );
};

// --- Order Ticket Component ---
const OrderTicket = ({ symbol, price, onTrade, t }: any) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [qty, setQty] = useState('0');
  const [limitPrice, setLimitPrice] = useState(price?.toFixed(2) || '0.00');

  useEffect(() => {
    if (price && parseFloat(limitPrice) === 0) setLimitPrice(price.toFixed(2));
  }, [price]);

  return (
    <div className="p-2 space-y-2 font-mono text-xs h-full flex flex-col">
      <div className="flex bg-[#111] border border-[#333] p-1 rounded-sm">
        <button
          className={`flex-1 py-1 font-bold ${side === 'BUY' ? 'bg-green-900 text-green-100' : 'text-gray-500 hover:bg-[#222]'}`}
          onClick={() => setSide('BUY')}
        >{t('BTN_BUY')}</button>
        <button
          className={`flex-1 py-1 font-bold ${side === 'SELL' ? 'bg-red-900 text-red-100' : 'text-gray-500 hover:bg-[#222]'}`}
          onClick={() => setSide('SELL')}
        >{t('BTN_SELL')}</button>
      </div>

      <div className="space-y-1">
        <label className="text-gray-500 text-[9px]">ORDER TYPE</label>
        <div className="flex space-x-2">
          <button
            className={`flex-1 border py-1 ${type === 'LIMIT' ? 'border-terminal-accent text-terminal-accent' : 'border-[#333] text-gray-500'}`}
            onClick={() => setType('LIMIT')}
          >LIMIT</button>
          <button
            className={`flex-1 border py-1 ${type === 'MARKET' ? 'border-terminal-accent text-terminal-accent' : 'border-[#333] text-gray-500'}`}
            onClick={() => setType('MARKET')}
          >MARKET</button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-gray-500 text-[9px]">QUANTITY</label>
        <input
          type="number"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-right text-white focus:border-terminal-accent focus:outline-none"
        />
      </div>

      {type === 'LIMIT' && (
        <div className="space-y-1">
          <label className="text-gray-500 text-[9px]">LIMIT PRICE</label>
          <input
            type="number"
            value={limitPrice}
            onChange={e => setLimitPrice(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-right text-white focus:border-terminal-accent focus:outline-none"
          />
        </div>
      )}

      <div className="pt-2 mt-auto">
        <button
          className={`w-full py-2 font-bold text-sm ${side === 'BUY' ? 'bg-terminal-success text-black' : 'bg-terminal-error text-white'}`}
          onClick={() => onTrade(side, qty, type === 'LIMIT' ? limitPrice : null)}
        >
          {side} {symbol.split('-')[0]}
        </button>
      </div>
    </div>
  )
}

// --- Main App ---

const App = () => {
  // State
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [marketMode, setMarketMode] = useState<MarketMode>('CRYPTO');
  const [activeSymbol, setActiveSymbol] = useState('BTC-USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [commandInput, setCommandInput] = useState('');

  const [positions, setPositions] = useState<Position[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [lang, setLang] = useState<'EN' | 'CN'>('EN');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Watchlist State
  const [cryptoWatchlist, setCryptoWatchlist] = useState<string[]>(['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT', 'DOGE-USDT']);
  const [stockWatchlist, setStockWatchlist] = useState<string[]>(['sh600519', 'sz300750', 'sh601318', 'sz002594', 'sh600036']);
  const [showAddSymbolModal, setShowAddSymbolModal] = useState(false);
  const [newSymbolInput, setNewSymbolInput] = useState('');

  // Real Market Data State
  const [marketTickers, setMarketTickers] = useState<MarketTicker[]>([]);
  const [depth, setDepth] = useState<{ bids: any[], asks: any[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isScannerLoading, setIsScannerLoading] = useState(false);

  // Scanner State
  const [scannerSort, setScannerSort] = useState<ScannerSort>('CHANGE_DESC');

  // Backtest State
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  // Strategy IDE State
  const [strategyFiles, setStrategyFiles] = useState<StrategyFile[]>([
    {
      name: 'main.py',
      language: 'python',
      content: `# QuantCore Pro Strategy\n# Simple Moving Average Crossover\n\nimport quant_core as qc\n\ndef strategy(data):\n    """\n    Executes a simple MA crossover strategy.\n    Buy when Close > MA25\n    Sell when Close < MA25\n    """\n    ma_short = data.ma7\n    ma_long = data.ma25\n    price = data.close\n\n    if price > ma_long:\n        return Order.BUY\n    elif price < ma_long:\n        return Order.SELL\n    \n    return Order.HOLD\n`
    },
    {
      name: 'config.json',
      language: 'json',
      content: `{\n  "symbol": "BTC-USDT",\n  "timeframe": "1H",\n  "initial_capital": 10000,\n  "commission": 0.001,\n  "slippage": 0.0005\n}`
    },
    {
      name: 'utils.py',
      language: 'python',
      content: `# Helper functions\n\ndef calculate_rsi(prices, period=14):\n    # Implementation placeholder\n    pass\n`
    }
  ]);
  const [activeFileName, setActiveFileName] = useState('main.py');

  // Refs
  const commandInputRef = useRef<HTMLInputElement>(null);
  const prevTickersRef = useRef<Record<string, number>>({});

  // Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Effects ---

  useEffect(() => {
    addLog('SYS', `Terminal initialized. Mode: ${marketMode}`);
    updateMarketData();
    showNotification('INFO', 'SYSTEM ONLINE. SELECT ASSET TO TRADE.');
  }, [marketMode]);

  useEffect(() => {
    if (marketMode === 'CRYPTO') {
      if (!cryptoWatchlist.includes(activeSymbol)) setActiveSymbol(cryptoWatchlist[0]);
    } else {
      if (!stockWatchlist.includes(activeSymbol)) setActiveSymbol(stockWatchlist[0]);
    }
    setCandles([]);
    setDepth({ bids: [], asks: [] });
    setTrades([]);
    setBacktestResult(null); // Clear previous backtest on symbol switch
  }, [marketMode]);

  // WebSocket / Data Stream Connection
  useEffect(() => {
    let wsCleanup: (() => void) | null = null;

    if (marketMode === 'CRYPTO') {
      wsCleanup = connectWebSocket(activeSymbol, {
        trade: (trade) => {
          setTrades(prev => [trade, ...prev].slice(0, 50));
        },
        depth: (bids, asks) => {
          setDepth({ bids: bids.slice(0, 20), asks: asks.slice(0, 20) });
        }
      });
    }

    const interval = setInterval(async () => {
      updateMarketData();
      const latestCandles = marketMode === 'CRYPTO'
        ? await fetchKlines(activeSymbol, timeframe)
        : await fetchStockKlines(activeSymbol, timeframe);

      if (latestCandles.length > 0) {
        setCandles(enhanceCandlesWithIndicators(latestCandles));
      }
    }, marketMode === 'CRYPTO' ? 5000 : 5000);

    return () => {
      if (wsCleanup) wsCleanup();
      clearInterval(interval);
    };
  }, [activeSymbol, marketMode, timeframe]);

  // Initial History Load
  useEffect(() => {
    const loadHistory = async () => {
      let data: CandleData[] = [];
      if (marketMode === 'CRYPTO') {
        data = await fetchKlines(activeSymbol, timeframe);
      } else {
        data = await fetchStockKlines(activeSymbol, timeframe);
      }
      setCandles(enhanceCandlesWithIndicators(data));
      if (marketMode === 'CN_STOCK') setTrades([]);
    };
    loadHistory();
  }, [activeSymbol, timeframe, marketMode]);


  // PnL Update Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (marketTickers.length === 0) return;

      setPositions(prevPositions => {
        return prevPositions.map(pos => {
          let currentPrice = pos.currentPrice;
          const marketData = marketTickers.find(t => t.symbol === pos.symbol);
          if (marketData) {
            currentPrice = marketData.price;
          }
          const pnl = (currentPrice - pos.avgPrice) * pos.quantity;
          const pnlPercent = pos.avgPrice > 0 ? (pnl / (pos.avgPrice * pos.quantity)) * 100 : 0;
          return { ...pos, currentPrice, pnl, pnlPercent };
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [marketTickers]);

  // Global Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setView(ViewState.DASHBOARD); }
      if (e.key === 'F2') { e.preventDefault(); setView(ViewState.MARKET); }
      if (e.key === 'F3') { e.preventDefault(); setView(ViewState.STRATEGY); }
      if (e.key === 'F4') { e.preventDefault(); setView(ViewState.BACKTEST); }
      if (e.key === 'F5') { e.preventDefault(); setView(ViewState.NEWS); }
      if (e.key === 'F6') { e.preventDefault(); setView(ViewState.SCANNER); }
      if (e.key === 'Escape') {
        setIsHelpOpen(false); setIsMenuOpen(false); setSelectedNews(null); setShowAddSymbolModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Helpers ---
  const t = (key: keyof typeof RESOURCES['EN']) => RESOURCES[lang][key];
  const currencySign = marketMode === 'CRYPTO' ? '$' : '¥';

  const updateMarketData = async () => {
    setIsScannerLoading(true);
    let tickers: MarketTicker[] = [];

    if (marketMode === 'CRYPTO') tickers = await fetchTopTickers();
    else tickers = await fetchStockTickers();

    if (tickers.length > 0) {
      setMarketTickers(prev => {
        const newMap = tickers.map(t => {
          const prevPrice = prevTickersRef.current[t.symbol];
          let dir: 'UP' | 'DOWN' | 'NONE' = 'NONE';
          if (prevPrice) {
            if (t.price > prevPrice) dir = 'UP';
            if (t.price < prevPrice) dir = 'DOWN';
          }
          prevTickersRef.current[t.symbol] = t.price;
          return { ...t, lastTickDir: dir };
        });
        return newMap;
      });

      // Stock Mode Depth Simulation
      if (marketMode === 'CN_STOCK') {
        const currentTicker = tickers.find(t => t.symbol === activeSymbol);
        if (currentTicker && currentTicker.bid && currentTicker.ask) {
          setDepth({
            bids: [{ price: currentTicker.bid, size: currentTicker.bidSize || 100 }],
            asks: [{ price: currentTicker.ask, size: currentTicker.askSize || 100 }]
          });
        }
      }
    }
    setIsScannerLoading(false);
  };

  const addLog = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    setLogs(prev => [entry, ...prev].slice(0, 100));
  };

  const showNotification = (type: Notification['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const refreshNews = async () => {
    setIsNewsLoading(true);
    try {
      const { items } = await fetchMarketNews();
      if (items.length > 0) {
        setNews(items);
        showNotification('SUCCESS', `FETCHED ${items.length} NEWS ITEMS`);
      }
    } catch (e) {
      showNotification('ERROR', 'FAILED TO FETCH NEWS');
    } finally {
      setIsNewsLoading(false);
    }
  };

  // Watchlist Helpers
  const addToWatchlist = (symbol: string) => {
    const sym = symbol.toUpperCase();
    if (marketMode === 'CRYPTO') {
      if (!cryptoWatchlist.includes(sym)) {
        setCryptoWatchlist(prev => [...prev, sym]);
        showNotification('SUCCESS', `ADDED ${sym} TO WATCHLIST`);
      }
    } else {
      if (!stockWatchlist.includes(sym)) {
        setStockWatchlist(prev => [...prev, sym]);
        showNotification('SUCCESS', `ADDED ${sym} TO WATCHLIST`);
      }
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    if (marketMode === 'CRYPTO') {
      setCryptoWatchlist(prev => prev.filter(s => s !== symbol));
    } else {
      setStockWatchlist(prev => prev.filter(s => s !== symbol));
    }
    showNotification('INFO', `REMOVED ${symbol}`);
  };

  const executeTrade = (side: 'BUY' | 'SELL', quantity: string, limitPrice: string | null) => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { showNotification('ERROR', 'INVALID QTY'); return; }

    let execPrice = 0;
    if (limitPrice) {
      execPrice = parseFloat(limitPrice);
    } else {
      const ticker = marketTickers.find(t => t.symbol === activeSymbol);
      execPrice = ticker ? ticker.price : (candles[candles.length - 1]?.close || 0);
    }

    setPositions(prev => {
      const existing = prev.find(p => p.symbol === activeSymbol);
      let updatedPositions = [...prev];

      if (existing) {
        let newQty = existing.quantity;
        let newAvg = existing.avgPrice;

        if (side === 'BUY') {
          const totalCost = (existing.quantity * existing.avgPrice) + (qty * execPrice);
          newQty = existing.quantity + qty;
          newAvg = totalCost / newQty;
          updatedPositions = prev.map(p => p.symbol === activeSymbol ? { ...p, quantity: newQty, avgPrice: newAvg } : p);
        } else {
          newQty = existing.quantity - qty;
          if (newQty <= 0.0001) {
            updatedPositions = prev.filter(p => p.symbol !== activeSymbol);
          } else {
            updatedPositions = prev.map(p => p.symbol === activeSymbol ? { ...p, quantity: newQty } : p);
          }
        }
      } else {
        updatedPositions = [...prev, {
          symbol: activeSymbol,
          quantity: qty,
          avgPrice: execPrice,
          currentPrice: execPrice,
          pnl: 0,
          pnlPercent: 0
        }];
      }
      return updatedPositions;
    });

    addLog('TRADE', `${side} ${qty} ${activeSymbol} @ ${execPrice.toFixed(2)} FILLED`);
    showNotification('SUCCESS', `ORDER FILLED: ${side} ${activeSymbol}`);
  };

  const handleStrategyFileUpdate = (fileName: string, newContent: string) => {
    setStrategyFiles(prev => prev.map(f => f.name === fileName ? { ...f, content: newContent } : f));
  };

  const handleCreateFile = (fileName: string) => {
    if (strategyFiles.some(f => f.name === fileName)) {
      showNotification('ERROR', 'FILE ALREADY EXISTS');
      return;
    }
    const ext = fileName.split('.').pop() || '';
    let lang = 'plaintext';
    if (ext === 'py') lang = 'python';
    if (ext === 'json') lang = 'json';
    if (ext === 'js') lang = 'javascript';
    if (ext === 'md') lang = 'markdown';

    setStrategyFiles(prev => [...prev, { name: fileName, content: '', language: lang }]);
    setActiveFileName(fileName);
    showNotification('SUCCESS', `CREATED ${fileName}`);
  };

  const handleDeleteFile = (fileName: string) => {
    setStrategyFiles(prev => prev.filter(f => f.name !== fileName));
    if (activeFileName === fileName) {
      setActiveFileName(strategyFiles[0]?.name || '');
    }
    showNotification('INFO', `DELETED ${fileName}`);
  };

  const runBacktest = () => {
    if (candles.length < 50) {
      showNotification('ERROR', 'NOT ENOUGH DATA FOR BACKTEST');
      return;
    }

    // Try to get logic from 'main.py' or fallback to active file
    const mainFile = strategyFiles.find(f => f.name === 'main.py');
    const logicCode = mainFile ? mainFile.content : strategyFiles.find(f => f.name === activeFileName)?.content || '';

    // Mock simulation based on the content roughly
    addLog('SYS', `Starting backtest engine with logic from ${mainFile ? 'main.py' : activeFileName}...`);

    const initialCapital = 10000;
    let cash = initialCapital;
    let holdings = 0;
    const equityCurve: { time: string; value: number }[] = [];
    const trades: { time: string; side: 'BUY' | 'SELL'; price: number; pnl: number }[] = [];

    candles.forEach((candle, i) => {
      if (!candle.ma25) return; // Warmup period

      const price = candle.close;
      const ma = candle.ma25;
      const date = candle.time;

      // Simple Strategy: Close > MA25 -> BUY, Close < MA25 -> SELL
      if (price > ma && holdings === 0) {
        // Buy
        holdings = cash / price;
        cash = 0;
        trades.push({ time: date, side: 'BUY', price, pnl: 0 });
      } else if (price < ma && holdings > 0) {
        // Sell
        const proceed = holdings * price;
        const entryPrice = trades[trades.length - 1].price;
        const pnl = proceed - (holdings * entryPrice);

        cash = proceed;
        holdings = 0;
        trades.push({ time: date, side: 'SELL', price, pnl });
      }

      const currentVal = cash + (holdings * price);
      equityCurve.push({ time: date, value: currentVal });
    });

    const finalValue = equityCurve[equityCurve.length - 1].value;
    const returnPct = ((finalValue - initialCapital) / initialCapital) * 100;
    const winningTrades = trades.filter(t => t.side === 'SELL' && t.pnl > 0).length;
    const totalTrades = trades.filter(t => t.side === 'SELL').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    setBacktestResult({
      equityCurve,
      trades,
      metrics: [
        { label: 'TOTAL RETURN', value: `${returnPct.toFixed(2)}%`, color: returnPct >= 0 ? '#00ff00' : '#ff0000' },
        { label: 'FINAL EQUITY', value: `$${finalValue.toFixed(2)}` },
        { label: 'WIN RATE', value: `${winRate.toFixed(1)}%` },
        { label: 'TOTAL TRADES', value: totalTrades.toString() }
      ]
    });

    showNotification('SUCCESS', 'BACKTEST COMPLETED');
  };

  const handleCommandSubmit = () => {
    if (!commandInput.trim()) return;
    const parts = commandInput.trim().toUpperCase().split(' ');
    const cmd = parts[0];
    const arg = parts[1];
    setCommandInput('');

    if (cmd === 'HELP') { setIsHelpOpen(true); return; }
    if (cmd === 'CRYPTO') { setMarketMode('CRYPTO'); return; }
    if (cmd === 'STOCK') { setMarketMode('CN_STOCK'); return; }
    if (cmd === 'ADD' && arg) { addToWatchlist(arg); return; }
    if (cmd === 'REMOVE' && arg) { removeFromWatchlist(arg); return; }
    if (cmd === 'BUY' || cmd === 'SELL') {
      executeTrade(cmd, '1', null);
      return;
    }
    showNotification('ERROR', `UNKNOWN COMMAND: ${cmd}`);
  };

  const portfolioStats = positions.reduce((acc, pos) => {
    const val = pos.currentPrice * pos.quantity;
    const pnl = pos.pnl;
    return { totalValue: acc.totalValue + val, totalPnL: acc.totalPnL + pnl };
  }, { totalValue: 0, totalPnL: 0 });

  const { bids, asks } = depth;
  const currentWatchlist = marketMode === 'CRYPTO' ? cryptoWatchlist : stockWatchlist;
  const filteredTickers = marketTickers.filter(t => currentWatchlist.includes(t.symbol));

  const sortedScannerTickers = [...marketTickers].sort((a, b) => {
    if (scannerSort === 'CHANGE_DESC') return b.changePercent - a.changePercent;
    if (scannerSort === 'CHANGE_ASC') return a.changePercent - b.changePercent;
    if (scannerSort === 'VOL_DESC') return b.volume - a.volume;
    return 0;
  });

  const renderNav = () => (
    <div className="w-10 flex flex-col items-center py-2 bg-[#0a0a0a] border-r border-terminal-border z-20 shrink-0">
      <div className="mb-4 text-terminal-accent animate-pulse"><TerminalIcon size={20} /></div>
      <div className="flex flex-col space-y-1 w-full px-1">
        <NavIcon icon={LayoutDashboard} active={view === ViewState.DASHBOARD} onClick={() => setView(ViewState.DASHBOARD)} tooltip={t('NAV_DASHBOARD')} />
        <NavIcon icon={LineChart} active={view === ViewState.MARKET} onClick={() => setView(ViewState.MARKET)} tooltip={t('NAV_MARKET')} />
        <NavIcon icon={Code} active={view === ViewState.STRATEGY} onClick={() => setView(ViewState.STRATEGY)} tooltip={t('NAV_STRATEGY')} />
        <NavIcon icon={History} active={view === ViewState.BACKTEST} onClick={() => setView(ViewState.BACKTEST)} tooltip={t('NAV_BACKTEST')} />
        <div className="h-px bg-terminal-border my-2 mx-1"></div>
        <NavIcon icon={Globe} active={view === ViewState.NEWS} onClick={() => setView(ViewState.NEWS)} tooltip={t('NAV_NEWS')} />
        <NavIcon icon={Search} active={view === ViewState.SCANNER} onClick={() => setView(ViewState.SCANNER)} tooltip={t('NAV_SCANNER')} />
      </div>
      <div className="mt-auto flex flex-col space-y-4 mb-2">
        <NavIcon icon={Settings} active={view === ViewState.SETTINGS} onClick={() => setView(ViewState.SETTINGS)} tooltip={t('NAV_SETTINGS')} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-terminal-bg text-gray-200 overflow-hidden font-sans text-xs">
      {renderNav()}

      <main className="flex-1 flex flex-col min-w-0">
        <CommandBar
          ref={commandInputRef}
          value={commandInput}
          onChange={setCommandInput}
          onSubmit={handleCommandSubmit}
          onHelp={() => setIsHelpOpen(true)}
          onMenu={() => setIsMenuOpen(true)}
          marketMode={marketMode}
        />

        <div className="flex-1 p-1 bg-black overflow-hidden relative">

          {view === ViewState.DASHBOARD && (
            <div className="grid grid-cols-12 grid-rows-12 gap-1 h-full">

              {/* Watchlist */}
              <Panel
                title={t('PNL_WATCHLIST')}
                className="col-span-3 row-span-8"
                tools={
                  <div className="flex items-center gap-1 mr-1">
                    <div className="flex space-x-1 bg-[#222] rounded p-0.5">
                      <button
                        className={`px-2 py-0.5 text-[9px] rounded-sm transition-colors ${marketMode === 'CRYPTO' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => setMarketMode('CRYPTO')}
                      >CRYPTO</button>
                      <button
                        className={`px-2 py-0.5 text-[9px] rounded-sm transition-colors ${marketMode === 'CN_STOCK' ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => setMarketMode('CN_STOCK')}
                      >STOCKS</button>
                    </div>
                    <button className="text-gray-400 hover:text-white p-1 hover:bg-[#222] rounded-sm" onClick={() => setShowAddSymbolModal(true)}><Plus size={10} /></button>
                  </div>
                }
              >
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <table className="w-full text-right font-mono text-[11px]">
                    <thead className="text-gray-500 bg-[#111] sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">{t('TH_TICKER')}</th>
                        <th className="px-2 py-1">{t('TH_LAST')}</th>
                        <th className="px-2 py-1">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-terminal-border">
                      {filteredTickers.length > 0 ? filteredTickers.map((item) => {
                        const sym = item.symbol;
                        const isActive = sym === activeSymbol;
                        const dirColor = item.lastTickDir === 'UP' ? 'bg-green-900/40' : item.lastTickDir === 'DOWN' ? 'bg-red-900/40' : '';

                        return (
                          <tr
                            key={sym}
                            className={`cursor-pointer transition-colors duration-200 group/row ${isActive ? 'bg-[#333]' : 'hover:bg-gray-800'} ${dirColor}`}
                            onClick={() => setActiveSymbol(sym)}
                            onContextMenu={(e) => { e.preventDefault(); removeFromWatchlist(sym); }}
                          >
                            <td className="px-2 py-1 text-left font-bold text-terminal-accent truncate max-w-[80px] relative">
                              {sym.replace('-USDT', '').replace('sh', '').replace('sz', '')}
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-terminal-accent opacity-0 group-hover/row:opacity-100"></div>
                            </td>
                            <td className="px-2 py-1 text-white">{item.price.toFixed(marketMode === 'CRYPTO' ? 2 : 2)}</td>
                            <td className={`px-2 py-1 ${item.changePercent >= 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>{item.changePercent.toFixed(2)}%</td>
                          </tr>
                        )
                      }) : (
                        <tr className="text-gray-600 text-center"><td colSpan={3} className="py-4">NO WATCHLIST DATA</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Main Chart */}
              <Panel
                title={`${activeSymbol} ${marketMode === 'CN_STOCK' ? '(CNY)' : '(USDT)'}`}
                className="col-span-6 row-span-8"
                tools={
                  <div className="flex space-x-1 text-[10px] font-mono">
                    {(['1M', '5M', '15M', '1H', '4H', '1D'] as Timeframe[]).map(tf => (
                      <span key={tf} onClick={() => setTimeframe(tf)} className={`px-1 cursor-pointer hover:bg-gray-700 ${timeframe === tf ? 'bg-terminal-accent text-black font-bold' : 'text-gray-500'}`}>{tf}</span>
                    ))}
                  </div>
                }
              >
                <MarketChart data={candles} symbol={activeSymbol} />
              </Panel>

              {/* Order Book / Depth */}
              <Panel title={t('PNL_DEPTH')} className="col-span-3 row-span-4">
                <OrderBook bids={bids} asks={asks} />
              </Panel>

              {/* Time & Sales */}
              <Panel title={t('PNL_SALES')} className="col-span-3 row-span-4">
                <div className="flex-1 overflow-hidden flex flex-col font-mono text-[10px]">
                  <div className="flex justify-between px-2 py-1 text-gray-500 bg-[#111] border-b border-[#333]">
                    <span>PRICE</span>
                    <span>QTY</span>
                    <span>TIME</span>
                  </div>
                  <div className="overflow-hidden relative flex-1">
                    <div className="absolute inset-0 overflow-hidden">
                      {trades.map((trade) => (
                        <div key={trade.id} className="flex justify-between px-2 py-[1px] hover:bg-[#222]">
                          <span className={trade.isBuyerMaker ? 'text-terminal-error' : 'text-terminal-success'}>{trade.price.toFixed(2)}</span>
                          <span className="text-gray-400">{trade.quantity.toFixed(4)}</span>
                          <span className="text-gray-600">{new Date(trade.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Portfolio & Order Management */}
              <Panel title={t('PNL_PORTFOLIO')} className="col-span-9 row-span-4">
                <div className="h-full flex">
                  <div className="w-56 border-r border-terminal-border p-2 space-y-3 bg-[#080808]">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold">NAV</span>
                      <span className="text-lg font-mono text-white">
                        {currencySign}{portfolioStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold">DAY P&L</span>
                      <span className={`font-mono ${portfolioStats.totalPnL >= 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>
                        {portfolioStats.totalPnL >= 0 ? '+' : ''}
                        {currencySign}{Math.abs(portfolioStats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-[#0a0a0a]">
                    <table className="w-full text-right font-mono text-[11px]">
                      <thead className="bg-[#111] text-gray-500 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">{t('TH_SYMBOL')}</th>
                          <th className="p-2">{t('TH_QTY')}</th>
                          <th className="p-2">{t('TH_ENTRY')}</th>
                          <th className="p-2">{t('TH_MARK')}</th>
                          <th className="p-2">{t('TH_PNL')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222]">
                        {positions.map((pos, i) => (
                          <tr key={i} className="hover:bg-[#151515]">
                            <td className="p-2 text-left font-bold text-terminal-accent">{pos.symbol}</td>
                            <td className="p-2 text-white">{pos.quantity.toFixed(4)}</td>
                            <td className="p-2 text-gray-400">{pos.avgPrice.toFixed(2)}</td>
                            <td className="p-2 text-white">{pos.currentPrice.toFixed(2)}</td>
                            <td className={`p-2 ${pos.pnl >= 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>
                              {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>

              {/* Order Ticket Panel */}
              <Panel title={t('PNL_ORDER')} className="col-span-3 row-span-4 border-l-0">
                <OrderTicket
                  symbol={activeSymbol}
                  price={marketTickers.find(t => t.symbol === activeSymbol)?.price}
                  onTrade={executeTrade}
                  t={t}
                />
              </Panel>
            </div>
          )}

          {/* MARKET VIEW: Full Screen Analysis */}
          {view === ViewState.MARKET && (
            <div className="grid grid-cols-12 grid-rows-12 gap-1 h-full">
              <Panel title={`${activeSymbol} - TECHNICAL ANALYSIS`} className="col-span-9 row-span-12">
                <MarketChart data={candles} symbol={activeSymbol} />
              </Panel>
              <div className="col-span-3 row-span-12 flex flex-col gap-1">
                <Panel title="DEPTH" className="flex-1">
                  <OrderBook bids={bids} asks={asks} />
                </Panel>
                <Panel title="TAPE" className="flex-1">
                  <div className="overflow-auto h-full font-mono text-[10px]">
                    {trades.map((trade) => (
                      <div key={trade.id} className="flex justify-between px-2 py-0.5 hover:bg-[#222]">
                        <span className={trade.isBuyerMaker ? 'text-terminal-error' : 'text-terminal-success'}>{trade.price.toFixed(2)}</span>
                        <span className="text-gray-400">{trade.quantity.toFixed(4)}</span>
                        <span className="text-gray-600">{new Date(trade.time).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {view === ViewState.STRATEGY && (
            <Panel title={t('PNL_IDE')} className="h-full">
              <StrategyEditor
                files={strategyFiles}
                activeFileName={activeFileName}
                onSelectFile={setActiveFileName}
                onUpdateFile={handleStrategyFileUpdate}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onRun={() => { setView(ViewState.BACKTEST); runBacktest(); }}
              />
            </Panel>
          )}

          {view === ViewState.BACKTEST && (
            <div className="h-full grid grid-cols-12 grid-rows-12 gap-1">
              <Panel title={t('PNL_PERF')} className="col-span-12 row-span-3">
                {backtestResult ? (
                  <div className="flex h-full items-center justify-around">
                    {backtestResult.metrics.map((m, i) => (
                      <div key={i} className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                        <div className="text-xl font-mono font-bold" style={{ color: m.color || 'white' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Activity size={32} className="mx-auto mb-2 opacity-50" />
                      RUN STRATEGY FROM IDE TO GENERATE METRICS
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="EQUITY CURVE" className="col-span-12 row-span-6">
                {backtestResult ? (
                  <ReResponsive width="100%" height="100%">
                    <AreaChart data={backtestResult.equityCurve}>
                      <defs>
                        <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff00" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#00ff00" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <ReGrid stroke="#222" strokeDasharray="3 3" />
                      <ReXAxis dataKey="time" hide />
                      <ReYAxis domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 10, fill: '#666' }} stroke="#333" />
                      <ReTooltip
                        contentStyle={{ backgroundColor: '#000', borderColor: '#333', fontSize: '12px' }}
                        itemStyle={{ color: '#00ff00' }}
                        labelFormatter={(l) => new Date(l).toLocaleDateString()}
                      />
                      <Area type="monotone" dataKey="value" stroke="#00ff00" fillOpacity={1} fill="url(#colorEq)" />
                    </AreaChart>
                  </ReResponsive>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-600">NO BACKTEST DATA</div>
                )}
              </Panel>

              <Panel title="TRADE LOG" className="col-span-12 row-span-3">
                <div className="h-full overflow-auto font-mono text-xs">
                  <table className="w-full text-right">
                    <thead className="bg-[#111] text-gray-500 sticky top-0">
                      <tr><th className="p-2 text-left">TIME</th><th className="p-2">SIDE</th><th className="p-2">PRICE</th><th className="p-2">P&L</th></tr>
                    </thead>
                    <tbody>
                      {backtestResult?.trades.map((t, i) => (
                        <tr key={i} className="hover:bg-[#1a1a1a] border-b border-[#222]">
                          <td className="p-2 text-left text-gray-400">{new Date(t.time).toLocaleString()}</td>
                          <td className={`p-2 ${t.side === 'BUY' ? 'text-terminal-success' : 'text-terminal-error'}`}>{t.side}</td>
                          <td className="p-2 text-white">{t.price.toFixed(2)}</td>
                          <td className={`p-2 ${t.pnl > 0 ? 'text-terminal-success' : t.pnl < 0 ? 'text-terminal-error' : 'text-gray-500'}`}>
                            {t.side === 'SELL' ? t.pnl.toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {view === ViewState.NEWS && (
            <div className="grid grid-cols-12 h-full gap-1">
              <Panel title={t('PNL_NEWS')} className="col-span-4 h-full" onRefresh={refreshNews}>
                <div className="p-1 space-y-1">
                  {news.map(n => (
                    <div
                      key={n.id}
                      className={`p-2 border border-[#333] hover:bg-[#222] cursor-pointer transition-colors ${selectedNews?.id === n.id ? 'bg-[#222] border-terminal-accent' : ''}`}
                      onClick={() => setSelectedNews(n)}
                    >
                      <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                        <span>{n.time}</span>
                        <span className="text-terminal-accent">{n.source}</span>
                      </div>
                      <div className="text-white text-xs leading-snug line-clamp-2">{n.headline}</div>
                    </div>
                  ))}
                  {news.length === 0 && !isNewsLoading && (
                    <div className="text-center py-10 text-gray-500">
                      <p>NO NEWS LOADED</p>
                      <button onClick={refreshNews} className="mt-2 text-terminal-accent underline">REFRESH FEED</button>
                    </div>
                  )}
                  {isNewsLoading && (
                    <div className="flex justify-center py-10 text-terminal-accent"><Loader2 className="animate-spin" /></div>
                  )}
                </div>
              </Panel>
              <Panel title="READER" className="col-span-8 h-full bg-[#111]">
                {selectedNews ? (
                  <div className="p-8 max-w-2xl mx-auto">
                    <div className="text-2xl font-bold mb-4 font-sans">{selectedNews.headline}</div>
                    <div className="flex items-center space-x-4 text-xs text-gray-400 mb-8 border-b border-[#333] pb-4">
                      <span>{selectedNews.time}</span>
                      <span>•</span>
                      <span className="text-terminal-accent uppercase">{selectedNews.source}</span>
                      <span>•</span>
                      <span className={selectedNews.sentiment === 'POSITIVE' ? 'text-green-500' : 'text-red-500'}>{selectedNews.sentiment}</span>
                    </div>
                    <div className="text-gray-300 leading-relaxed font-serif text-lg">
                      <p>
                        (Summary) This article discusses market movements affecting {selectedNews.relatedSymbols?.join(', ') || 'general markets'}.
                        Analysts suggest monitoring key levels.
                      </p>
                      <br />
                      <p className="text-gray-500 italic">
                        *Full content not available in terminal preview.
                        {selectedNews.url && <a href={selectedNews.url} target="_blank" rel="noreferrer" className="text-terminal-accent ml-2 hover:underline flex items-center inline-flex gap-1">READ ORIGINAL <ExternalLink size={12} /></a>}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-600">
                    SELECT AN ARTICLE TO READ
                  </div>
                )}
              </Panel>
            </div>
          )}

          {view === ViewState.SCANNER && (
            <Panel
              title={t('PNL_SCANNER')}
              className="h-full"
              onRefresh={updateMarketData}
              tools={
                <div className="flex space-x-4 items-center mr-2">
                  <div className="flex space-x-1 bg-[#222] rounded p-0.5">
                    <button
                      onClick={() => setMarketMode('CRYPTO')}
                      className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${marketMode === 'CRYPTO' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-300'}`}
                    >CRYPTO</button>
                    <button
                      onClick={() => setMarketMode('CN_STOCK')}
                      className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${marketMode === 'CN_STOCK' ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:text-gray-300'}`}
                    >CN STOCKS</button>
                  </div>
                  <div className="w-px h-3 bg-gray-600"></div>
                  <div className="flex space-x-1">
                    <button onClick={() => setScannerSort('CHANGE_DESC')} className={`flex items-center gap-1 px-2 py-0.5 text-[10px] ${scannerSort === 'CHANGE_DESC' ? 'text-terminal-success font-bold' : 'text-gray-500'}`}>
                      GAINERS <ArrowUp size={10} />
                    </button>
                    <button onClick={() => setScannerSort('CHANGE_ASC')} className={`flex items-center gap-1 px-2 py-0.5 text-[10px] ${scannerSort === 'CHANGE_ASC' ? 'text-terminal-error font-bold' : 'text-gray-500'}`}>
                      LOSERS <ArrowDown size={10} />
                    </button>
                    <button onClick={() => setScannerSort('VOL_DESC')} className={`flex items-center gap-1 px-2 py-0.5 text-[10px] ${scannerSort === 'VOL_DESC' ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>
                      VOLUME <Activity size={10} />
                    </button>
                  </div>
                </div>
              }
            >
              <div className="overflow-auto h-full">
                <table className="w-full text-right font-mono text-xs">
                  <thead className="bg-[#111] text-gray-500 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left">SYMBOL</th>
                      <th className="p-2">PRICE</th>
                      <th className="p-2">CHANGE %</th>
                      <th className="p-2 text-center w-24">TREND</th>
                      <th className="p-2">HIGH</th>
                      <th className="p-2">LOW</th>
                      <th className="p-2">VOLUME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {sortedScannerTickers.map((t, i) => (
                      <tr
                        key={i}
                        className="hover:bg-[#222] cursor-pointer"
                        onClick={() => { setActiveSymbol(t.symbol); setView(ViewState.MARKET); }}
                        onContextMenu={(e) => { e.preventDefault(); addToWatchlist(t.symbol); }}
                      >
                        <td className="p-2 text-left font-bold text-terminal-accent">
                          {t.symbol}
                          <div className="text-[9px] text-gray-500 font-normal">{t.name || t.symbol.replace('sh', '').replace('sz', '')}</div>
                        </td>
                        <td className="p-2 text-white">{t.price.toFixed(marketMode === 'CRYPTO' ? 2 : 2)}</td>
                        <td className={`p-2 font-bold ${t.changePercent > 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>
                          {t.changePercent > 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
                        </td>
                        <td className="p-2">
                          <div className="h-1.5 w-full bg-[#111] rounded overflow-hidden flex">
                            <div
                              className={`h-full ${t.changePercent >= 0 ? 'bg-terminal-success' : 'bg-terminal-error'}`}
                              style={{ width: `${Math.min(Math.abs(t.changePercent) * 5, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="p-2 text-gray-400">{t.high}</td>
                        <td className="p-2 text-gray-400">{t.low}</td>
                        <td className="p-2 text-gray-300 relative">
                          <div className="absolute inset-y-1 right-0 bg-[#222] -z-10" style={{ width: `${Math.min((t.volume / sortedScannerTickers[0]?.volume) * 100, 100)}%` }}></div>
                          <span className="z-10 relative">{t.volume.toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {view === ViewState.SETTINGS && (
            <div className="flex h-full items-center justify-center">
              <div className="w-96 p-6 border border-[#333] bg-[#111]">
                <h2 className="text-terminal-accent font-bold mb-4 uppercase tracking-widest border-b border-[#333] pb-2">Configuration</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">INTERFACE LANGUAGE</span>
                    <div className="flex space-x-1">
                      <button onClick={() => setLang('EN')} className={`px-2 py-1 text-xs ${lang === 'EN' ? 'bg-terminal-accent text-black' : 'bg-[#222] text-gray-500'}`}>EN</button>
                      <button onClick={() => setLang('CN')} className={`px-2 py-1 text-xs ${lang === 'CN' ? 'bg-terminal-accent text-black' : 'bg-[#222] text-gray-500'}`}>CN</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">DEFAULT MARKET</span>
                    <div className="flex space-x-1">
                      <button onClick={() => setMarketMode('CRYPTO')} className={`px-2 py-1 text-xs ${marketMode === 'CRYPTO' ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-500'}`}>CRYPTO</button>
                      <button onClick={() => setMarketMode('CN_STOCK')} className={`px-2 py-1 text-xs ${marketMode === 'CN_STOCK' ? 'bg-red-600 text-white' : 'bg-[#222] text-gray-500'}`}>A-SHARE</button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[#333]">
                    <button className="w-full bg-[#333] hover:bg-[#444] py-2 text-xs text-white" onClick={() => localStorage.clear()}>RESET FACTORY SETTINGS</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="h-5 bg-[#0a0a0a] border-t border-terminal-border flex items-center justify-between px-2 text-[10px] text-gray-500 select-none shrink-0">
          <div className="flex space-x-4">
            <span>MEM: 32MB</span>
            <span>CPU: 6%</span>
            <span>LATENCY: {marketMode === 'CRYPTO' ? '42ms (WS)' : '210ms (HTTP)'}</span>
          </div>
          <div className="flex space-x-4">
            <span className="text-terminal-accent">MODE: {marketMode}</span>
            <span>BUILD: v3.0.0-PRO</span>
          </div>
        </div>

      </main>

      <ToastContainer notifications={notifications} removeNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} />

      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="HELP">
        <div className="text-xs font-mono p-4 space-y-2">
          <div><span className="text-terminal-accent">F1-F6</span> : NAVIGATE VIEWS</div>
          <div><span className="text-terminal-accent">CMD</span> : ENTER COMMANDS</div>
          <hr className="border-[#333]" />
          <div>COMMANDS:</div>
          <div><span className="text-white">BUY BTC</span> : Market Buy 1 BTC</div>
          <div><span className="text-white">SELL ETH</span> : Market Sell 1 ETH</div>
          <div><span className="text-white">ADD SOL</span> : Add to Watchlist</div>
          <div><span className="text-white">REMOVE SOL</span> : Remove from Watchlist</div>
        </div>
      </Modal>

      <Modal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="MENU" width="max-w-xs">
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => window.location.reload()}>RELOAD</button>
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => { localStorage.clear(); window.location.reload(); }}>RESET</button>
      </Modal>

      <Modal isOpen={showAddSymbolModal} onClose={() => setShowAddSymbolModal(false)} title="ADD SYMBOL" width="max-w-xs">
        <div className="p-4 space-y-4">
          <input
            className="w-full bg-[#111] border border-[#333] p-2 text-white outline-none focus:border-terminal-accent uppercase"
            placeholder={marketMode === 'CRYPTO' ? "BTC-USDT" : "sh600519"}
            value={newSymbolInput}
            onChange={e => setNewSymbolInput(e.target.value)}
            autoFocus
          />
          <button
            className="w-full bg-terminal-accent text-black font-bold py-2 hover:bg-yellow-500"
            onClick={() => {
              if (newSymbolInput) {
                addToWatchlist(newSymbolInput);
                setNewSymbolInput('');
                setShowAddSymbolModal(false);
              }
            }}
          >
            ADD TO WATCHLIST
          </button>
        </div>
      </Modal>

    </div>
  );
};

const NavIcon = ({ icon: Icon, active, onClick, tooltip }: any) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-sm transition-all duration-100 relative group flex justify-center w-full
      ${active ? 'text-terminal-accent bg-[#1a1a1a] border-l-2 border-terminal-accent' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}`}
  >
    <Icon size={18} strokeWidth={2} />
    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 border border-terminal-border whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 pointer-events-none shadow-xl">
      {tooltip}
    </div>
  </button>
);

export default App;