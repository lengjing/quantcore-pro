import React, { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  LineChart,
  Code,
  History,
  Settings,
  Globe,
  Search,
  Terminal as TerminalIcon,
  AlertTriangle,
} from 'lucide-react';

import { ViewState } from './types';
import type { MarketMode } from './types';
import { RESOURCES } from './constants/resources';
import type { ResourceKey, LangKey } from './constants/resources';

// UI Components
import { Modal } from './components/ui/Modal';
import { Panel } from './components/ui/Panel';
import { CommandBar } from './components/ui/CommandBar';
import { ToastContainer } from './components/ui/Toast';
import { NavIcon } from './components/ui/NavIcon';

// Custom Hooks
import { useNotifications } from './hooks/useNotifications';
import { useWatchlist } from './hooks/useWatchlist';
import { useMarketData } from './hooks/useMarketData';
import { useStrategyFiles } from './hooks/useStrategyFiles';
import { useBacktest } from './hooks/useBacktest';
import { usePersisted } from './hooks/usePersisted';
import { useTradeEngine } from './hooks/useTradeEngine';

// View Components
import { DashboardView } from './views/DashboardView';
import { MarketView } from './views/MarketView';
import { BacktestView } from './views/BacktestView';
import { NewsView } from './views/NewsView';
import { ScannerView } from './views/ScannerView';
import { SettingsView } from './views/SettingsView';

// Existing Components
import StrategyEditor from './components/StrategyEditor';

// Utilities
import { clearAllState } from './utils/storage';

import type { Timeframe } from './types';

const App = () => {
  // --- Persisted Core State ---
  const [view, setView] = usePersisted<ViewState>('view', ViewState.DASHBOARD);
  const [marketMode, setMarketMode] = usePersisted<MarketMode>('marketMode', 'CRYPTO');
  const [activeSymbol, setActiveSymbol] = usePersisted<string>('activeSymbol', 'BTC-USDT');
  const [timeframe, setTimeframe] = usePersisted<Timeframe>('timeframe', '1H');
  const [lang, setLang] = usePersisted<LangKey>('lang', 'EN');
  const [stockAdapterId, setStockAdapterId] = usePersisted<string>('stockAdapterId', 'eastmoney');

  // --- Ephemeral UI State ---
  const [commandInput, setCommandInput] = usePersisted<string>('commandInput', '');
  const [isHelpOpen, setIsHelpOpen] = usePersisted<boolean>('isHelpOpen', false);
  const [isMenuOpen, setIsMenuOpen] = usePersisted<boolean>('isMenuOpen', false);
  const [showAddSymbolModal, setShowAddSymbolModal] = usePersisted<boolean>('showAddSymbolModal', false);
  const [newSymbolInput, setNewSymbolInput] = usePersisted<string>('newSymbolInput', '');

  const commandInputRef = useRef<HTMLInputElement>(null);

  // --- Hooks ---
  const { notifications, showNotification, removeNotification } = useNotifications();
  const { cryptoWatchlist, stockWatchlist, currentWatchlist, addToWatchlist, removeFromWatchlist } =
    useWatchlist(marketMode, showNotification);
  const { marketTickers, candles, liveCandle, depth, trades, isScannerLoading, updateMarketData } =
    useMarketData(activeSymbol, marketMode, timeframe, stockAdapterId);
  const {
    tradingMode,
    setTradingMode,
    positions,
    executeTrade,
    pendingOrder,
    confirmLiveOrder,
    cancelLiveOrder,
  } = useTradeEngine(activeSymbol, marketTickers, candles, showNotification);
  const {
    strategyFiles,
    activeFileName,
    setActiveFileName,
    handleStrategyFileUpdate,
    handleCreateFile,
    handleDeleteFile,
  } = useStrategyFiles(showNotification);
  const { backtestResult, runBacktest } = useBacktest(
    candles,
    strategyFiles,
    activeFileName,
    showNotification,
  );

  // --- Helpers ---
  const t = (key: ResourceKey): string => RESOURCES[lang][key];
  const currencySign = marketMode === 'CRYPTO' ? '$' : '¥';

  // --- Effects ---

  // Sync active symbol when market mode changes
  useEffect(() => {
    if (marketMode === 'CRYPTO') {
      if (!cryptoWatchlist.includes(activeSymbol)) {
        setActiveSymbol(cryptoWatchlist[0] ?? 'BTC-USDT');
      }
    } else {
      if (!stockWatchlist.includes(activeSymbol)) {
        setActiveSymbol(stockWatchlist[0] ?? '');
      }
    }
  }, [marketMode]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setView(ViewState.DASHBOARD); }
      if (e.key === 'F2') { e.preventDefault(); setView(ViewState.MARKET); }
      if (e.key === 'F3') { e.preventDefault(); setView(ViewState.STRATEGY); }
      if (e.key === 'F4') { e.preventDefault(); setView(ViewState.BACKTEST); }
      if (e.key === 'F5') { e.preventDefault(); setView(ViewState.NEWS); }
      if (e.key === 'F6') { e.preventDefault(); setView(ViewState.SCANNER); }
      if (e.key === 'Escape') {
        setIsHelpOpen(false);
        setIsMenuOpen(false);
        setShowAddSymbolModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Command Bar Handler ---
  const handleCommandSubmit = () => {
    if (!commandInput.trim()) return;
    const [cmd, arg] = commandInput.trim().toUpperCase().split(' ');
    setCommandInput('');
    if (cmd === 'HELP') { setIsHelpOpen(true); return; }
    if (cmd === 'CRYPTO') { setMarketMode('CRYPTO'); return; }
    if (cmd === 'STOCK') { setMarketMode('CN_STOCK'); return; }
    if (cmd === 'ADD' && arg) { addToWatchlist(arg); return; }
    if (cmd === 'REMOVE' && arg) { removeFromWatchlist(arg); return; }
    if (cmd === 'BUY' || cmd === 'SELL') { executeTrade(cmd, '1', null); return; }
    showNotification('ERROR', `UNKNOWN COMMAND: ${cmd}`);
  };

  // --- Derived State ---
  const portfolioStats = positions.reduce(
    (acc, pos) => ({
      totalValue: acc.totalValue + pos.currentPrice * pos.quantity,
      totalPnL: acc.totalPnL + pos.pnl,
    }),
    { totalValue: 0, totalPnL: 0 },
  );
  const filteredTickers = marketTickers.filter((ticker) => currentWatchlist.includes(ticker.symbol));

  // --- Render ---
  return (
    <div className="flex h-screen w-screen bg-terminal-bg text-gray-200 overflow-hidden font-sans text-xs">

      {/* Sidebar Navigation */}
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

      <main className="flex-1 flex flex-col min-w-0">
        <CommandBar
          ref={commandInputRef}
          value={commandInput}
          onChange={setCommandInput}
          onSubmit={handleCommandSubmit}
          onHelp={() => setIsHelpOpen(true)}
          onMenu={() => setIsMenuOpen(true)}
          marketMode={marketMode}
          setMarketMode={setMarketMode}
          stockAdapterId={stockAdapterId}
          setStockAdapter={setStockAdapterId}
          tradingMode={tradingMode}
          setTradingMode={setTradingMode}
        />

        <div className="flex-1 p-1 bg-black overflow-hidden relative">

          {view === ViewState.DASHBOARD && (
            <DashboardView
              marketMode={marketMode}
              activeSymbol={activeSymbol}
              setActiveSymbol={setActiveSymbol}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              candles={candles}
              liveCandle={liveCandle}
              depth={depth}
              trades={trades}
              positions={positions}
              marketTickers={marketTickers}
              filteredTickers={filteredTickers}
              currencySign={currencySign}
              portfolioStats={portfolioStats}
              t={t}
              removeFromWatchlist={removeFromWatchlist}
              setShowAddSymbolModal={setShowAddSymbolModal}
              executeTrade={executeTrade}
            />
          )}

          {view === ViewState.MARKET && (
            <MarketView
              marketTickers={marketTickers}
              marketMode={marketMode}
              setActiveSymbol={setActiveSymbol}
              setView={setView}
              onRefresh={updateMarketData}
            />
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
            <BacktestView backtestResult={backtestResult} t={t} />
          )}

          {view === ViewState.NEWS && (
            <NewsView t={t} />
          )}

          {view === ViewState.SCANNER && (
            <ScannerView
              marketMode={marketMode}
              marketTickers={marketTickers}
              isScannerLoading={isScannerLoading}
              updateMarketData={updateMarketData}
              addToWatchlist={addToWatchlist}
              setActiveSymbol={setActiveSymbol}
              setView={setView}
              t={t}
            />
          )}

          {view === ViewState.SETTINGS && (
            <SettingsView
              lang={lang}
              setLang={setLang}
              marketMode={marketMode}
              setMarketMode={setMarketMode}
              stockAdapterId={stockAdapterId}
              setStockAdapter={setStockAdapterId}
            />
          )}

        </div>

        {/* Status Bar */}
        <div className="h-5 bg-[#0a0a0a] border-t border-terminal-border flex items-center justify-between px-2 text-[10px] text-gray-500 select-none shrink-0">
          <div className="flex space-x-4">
            <span>MEM: 32MB</span>
            <span>CPU: 6%</span>
            <span>LATENCY: {marketMode === 'CRYPTO' ? '42ms (WS)' : '210ms (HTTP)'}</span>
          </div>
          <div className="flex space-x-4">
            <span className={tradingMode === 'LIVE' ? 'text-red-400 font-bold animate-pulse' : 'text-gray-500'}>
              {tradingMode === 'LIVE' ? '🔴 LIVE TRADING' : 'PAPER TRADING'}
            </span>
            <span className="text-terminal-accent">
              {marketMode === 'CRYPTO' ? 'CRYPTO' : `A-SHARE / ${stockAdapterId.toUpperCase()}`}
            </span>
            <span>BUILD: v3.0.0-PRO</span>
          </div>
        </div>
      </main>

      <ToastContainer notifications={notifications} removeNotification={removeNotification} />

      {/* Help Modal */}
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

      {/* Menu Modal */}
      <Modal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="MENU" width="max-w-xs">
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => window.location.reload()}>RELOAD</button>
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => {
          if (window.confirm('Reset all settings and data to factory defaults?')) {
            clearAllState();
            window.location.reload();
          }
        }}>RESET FACTORY</button>
      </Modal>

      {/* Add Symbol Modal */}
      <Modal isOpen={showAddSymbolModal} onClose={() => setShowAddSymbolModal(false)} title="ADD SYMBOL" width="max-w-xs">
        <div className="p-4 space-y-4">
          <input
            className="w-full bg-[#111] border border-[#333] p-2 text-white outline-none focus:border-terminal-accent uppercase"
            placeholder={marketMode === 'CRYPTO' ? 'BTC-USDT' : 'sh600519'}
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value)}
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

      {/* Live Order Confirmation Modal */}
      {pendingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-96 border-2 border-red-600 bg-[#0d0d0d] shadow-[0_0_30px_rgba(220,38,38,0.3)]">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-900/50 border-b border-red-700">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-red-300 font-bold text-xs uppercase tracking-widest">
                ⚠ LIVE ORDER — REAL FUNDS
              </span>
            </div>
            <div className="p-5 font-mono text-sm space-y-3">
              <div className="flex justify-between text-gray-400">
                <span>ACTION</span>
                <span className={pendingOrder.side === 'BUY' ? 'text-terminal-success font-bold' : 'text-terminal-error font-bold'}>
                  {pendingOrder.side}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>SYMBOL</span>
                <span className="text-white font-bold">{pendingOrder.symbol}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>QUANTITY</span>
                <span className="text-white">{pendingOrder.quantity}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>PRICE</span>
                <span className="text-white">{pendingOrder.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400 border-t border-[#333] pt-2">
                <span>TOTAL</span>
                <span className="text-terminal-accent font-bold">
                  {(pendingOrder.quantity * pendingOrder.price).toFixed(2)}
                </span>
              </div>
              <p className="text-red-400 text-[10px] pt-1">
                This order will be executed against the live exchange and may result in real financial loss.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[#333]">
              <button
                onClick={cancelLiveOrder}
                className="py-3 text-xs font-bold text-gray-300 hover:bg-[#222] border-r border-[#333] uppercase tracking-widest"
              >
                CANCEL
              </button>
              <button
                onClick={confirmLiveOrder}
                className="py-3 text-xs font-bold text-white bg-red-800 hover:bg-red-700 uppercase tracking-widest"
              >
                CONFIRM &amp; SEND
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
