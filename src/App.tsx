import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LineChart,
  Code,
  History,
  Settings,
  Globe,
  Search,
  AlertTriangle,
  Bot,
} from 'lucide-react';

import { ViewState } from './types';
import type { MarketMode, ColorScheme } from './types';
import type { AdapterCapability } from './services/stock/IStockDataAdapter';
import stockDataService from './services/stock/stockDataService';

// UI Components
import { Modal } from './components/ui/Modal';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Panel } from './components/ui/Panel';
import { CommandBar } from './components/ui/CommandBar';
import { TitleBar } from './components/ui/TitleBar';
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
import { AIAssistantView } from './views/AIAssistantView';

// Existing Components
import StrategyEditor from './components/StrategyEditor';

// Utilities
import { clearAllState } from './utils/storage';

// Sectors
import type { CustomSectorDef } from './data/sectors';

// i18n types
import type { LangKey } from './i18n';
import type { AISettings } from './types';
import { DEFAULT_AI_SETTINGS, normalizeAiSettings } from './services/ai/aiConfig';

import type { Timeframe } from './types';

const App = () => {
  const { t, i18n } = useTranslation();

  // --- Persisted Core State ---
  const [view, setView] = usePersisted<ViewState>('view', ViewState.DASHBOARD);
  const [marketMode, setMarketMode] = usePersisted<MarketMode>('marketMode', 'CRYPTO');
  const [activeSymbol, setActiveSymbol] = usePersisted<string>('activeSymbol', 'BTC-USDT');
  const [timeframe, setTimeframe] = usePersisted<Timeframe>('timeframe', '1H');
  const [colorScheme, setColorScheme] = usePersisted<ColorScheme>('colorScheme', 'greenUp');
  const [aiSettings, setAiSettings] = usePersisted<AISettings>('aiSettings', DEFAULT_AI_SETTINGS);
  const defaultCapMap = { realtime: 'eastmoney', dailyKlines: 'eastmoney', minuteKlines: 'eastmoney' };
  const [capMap, setCapMap] = usePersisted<Record<string, string>>('capMap', defaultCapMap);

  // Custom sectors — hoisted here so both MarketView and AIAssistantView share state
  const [customSectors, setCustomSectors] = usePersisted<CustomSectorDef[]>('customSectors', []);

  // --- Ephemeral UI State ---
  const [commandInput, setCommandInput] = usePersisted<string>('commandInput', '');
  const [isHelpOpen, setIsHelpOpen] = usePersisted<boolean>('isHelpOpen', false);
  const [isMenuOpen, setIsMenuOpen] = usePersisted<boolean>('isMenuOpen', false);
  const [showAddSymbolModal, setShowAddSymbolModal] = usePersisted<boolean>('showAddSymbolModal', false);
  const [newSymbolInput, setNewSymbolInput] = usePersisted<string>('newSymbolInput', '');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  useEffect(() => {
    const normalized = normalizeAiSettings(aiSettings);
    if (
      normalized.provider !== aiSettings.provider ||
      normalized.apiKey !== aiSettings.apiKey ||
      normalized.model !== aiSettings.model
    ) {
      setAiSettings(normalized);
    }
  }, [aiSettings, setAiSettings]);

  const commandInputRef = useRef<HTMLInputElement>(null);

  // --- Hooks ---
  const { notifications, showNotification, removeNotification } = useNotifications();
  const { cryptoWatchlist, stockWatchlist, currentWatchlist, addToWatchlist, removeFromWatchlist } =
    useWatchlist(marketMode, showNotification);
  const { marketTickers, candles, liveCandle, depth, trades, isScannerLoading, updateMarketData, connectionStatus, latencyMs } =
    useMarketData(activeSymbol, marketMode, timeframe);
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
    handleRenameFile,
  } = useStrategyFiles(showNotification);
  const { backtestResult, runBacktest } = useBacktest(
    candles,
    strategyFiles,
    activeFileName,
    showNotification,
  );

  // --- Helpers ---
  const currencySign = marketMode === 'CRYPTO' ? '$' : '¥';

  // --- System metrics (Electron only) ---
  const [systemMetrics, setSystemMetrics] = React.useState({ memMB: 0, cpuPercent: 0 });

  useEffect(() => {
    if (!window.electron?.getSystemMetrics) return;
    const poll = () => {
      window.electron!.getSystemMetrics().then(setSystemMetrics).catch(console.warn);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Effects ---

  // Sync multi-adapter settings with stockDataService on mount and when changed
  useEffect(() => {
    stockDataService.setMultiAdapterMode(true);
    for (const [cap, id] of Object.entries(capMap)) {
      stockDataService.setCapabilityAdapter(cap as AdapterCapability, id);
    }
  }, [capMap]);

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
      if (e.key === 'F7') { e.preventDefault(); setView(ViewState.AI); }
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
    <div className="flex flex-col h-screen w-screen bg-terminal-bg text-gray-200 overflow-hidden font-sans text-xs">
      <TitleBar />
      <div className="flex flex-1 min-h-0">

      {/* Sidebar Navigation */}
      <div className="w-10 flex flex-col items-center py-2 bg-[#0a0a0a] border-r border-terminal-border z-20 shrink-0">
       <div className="flex flex-col space-y-1 w-full px-1 mt-1">
         <NavIcon icon={LayoutDashboard} active={view === ViewState.DASHBOARD} onClick={() => setView(ViewState.DASHBOARD)} tooltip={t('NAV_DASHBOARD')} />
         <NavIcon icon={LineChart} active={view === ViewState.MARKET} onClick={() => setView(ViewState.MARKET)} tooltip={t('NAV_MARKET')} />
         <NavIcon icon={Code} active={view === ViewState.STRATEGY} onClick={() => setView(ViewState.STRATEGY)} tooltip={t('NAV_STRATEGY')} />
         <NavIcon icon={History} active={view === ViewState.BACKTEST} onClick={() => setView(ViewState.BACKTEST)} tooltip={t('NAV_BACKTEST')} />
         <div className="h-px bg-terminal-border my-2 mx-1"></div>
         <NavIcon icon={Globe} active={view === ViewState.NEWS} onClick={() => setView(ViewState.NEWS)} tooltip={t('NAV_NEWS')} />
         <NavIcon icon={Search} active={view === ViewState.SCANNER} onClick={() => setView(ViewState.SCANNER)} tooltip={t('NAV_SCANNER')} />
         <NavIcon icon={Bot} active={view === ViewState.AI} onClick={() => setView(ViewState.AI)} tooltip={t('NAV_AI')} />
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
          tradingMode={tradingMode}
          setTradingMode={setTradingMode}
          connectionStatus={connectionStatus}
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
              addToWatchlist={addToWatchlist}
              onRefresh={updateMarketData}
              customSectors={customSectors}
              setCustomSectors={setCustomSectors}
              colorScheme={colorScheme}
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
                onRenameFile={handleRenameFile}
                aiSettings={aiSettings}
                onRun={() => { setView(ViewState.BACKTEST); runBacktest(); }}
              />
            </Panel>
          )}

          {view === ViewState.BACKTEST && (
            <BacktestView backtestResult={backtestResult} />
          )}

          {view === ViewState.NEWS && (
            <NewsView />
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
            />
          )}

          {view === ViewState.SETTINGS && (
            <SettingsView
              marketMode={marketMode}
              setMarketMode={setMarketMode}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              capMap={capMap}
              setCapMap={setCapMap}
              aiSettings={aiSettings}
              setAiSettings={setAiSettings}
              vitePort={Number(process.env.VITE_PORT || process.env.VITE_DEV_PORT || 5173)}
              freeClaudePort={Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082)}
            />
          )}

          {view === ViewState.AI && (
            <AIAssistantView
              customSectors={customSectors}
              setCustomSectors={setCustomSectors}
              stockWatchlist={stockWatchlist}
              addToWatchlist={addToWatchlist}
              showNotification={showNotification}
              lang={(i18n.language === 'cn' ? 'CN' : 'EN') as LangKey}
              aiSettings={aiSettings}
              t={t}
            />
          )}

        </div>

        {/* Status Bar */}
        <div className="h-5 bg-[#0a0a0a] border-t border-terminal-border flex items-center justify-between px-2 text-[10px] text-gray-500 select-none shrink-0">
          <div className="flex space-x-4">
            <span>{t('LABEL_MEM')}: {systemMetrics.memMB}MB</span>
            <span>{t('LABEL_CPU')}: {systemMetrics.cpuPercent}%</span>
            <span>{t('LABEL_LATENCY')}: {latencyMs != null ? `${latencyMs}ms` : '—'} ({marketMode === 'CRYPTO' ? 'WS' : 'HTTP'})</span>
          </div>
          <div className="flex space-x-4">
            <span className={tradingMode === 'LIVE' ? 'text-red-400 font-bold animate-pulse' : 'text-gray-500'}>
              {tradingMode === 'LIVE' ? t('LIVE_TRADING') : t('PAPER_TRADING')}
            </span>
            <span className="text-terminal-accent">
              {marketMode === 'CRYPTO' ? 'CRYPTO' : `A-SHARE / ${capMap.realtime?.toUpperCase() ?? 'MULTI'}`}
            </span>
            <span>BUILD: v{__APP_VERSION__}</span>
          </div>
        </div>
      </main>
      </div>

      <ToastContainer notifications={notifications} removeNotification={removeNotification} />

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title={t('HELP')}>
        <div className="text-xs font-mono p-4 space-y-2">
          <div><span className="text-terminal-accent">F1-F6</span> : {t('NAVIGATE_VIEWS')}</div>
          <div><span className="text-terminal-accent">CMD</span> : {t('COMMANDS')}</div>
          <hr className="border-[#333]" />
          <div>{t('COMMANDS')}:</div>
          <div><span className="text-white">BUY BTC</span> : {t('CMD_BUY_EXAMPLE')}</div>
          <div><span className="text-white">SELL ETH</span> : {t('CMD_SELL_EXAMPLE')}</div>
          <div><span className="text-white">ADD SOL</span> : {t('CMD_ADD_EXAMPLE')}</div>
          <div><span className="text-white">REMOVE SOL</span> : {t('CMD_REMOVE_EXAMPLE')}</div>
        </div>
      </Modal>

      {/* Menu Modal */}
      <Modal isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title={t('MENU')} width="max-w-xs">
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => window.location.reload()}>{t('RELOAD')}</button>
        <button className="w-full text-left p-2 hover:bg-[#333]" onClick={() => {
          setIsMenuOpen(false);
          setShowResetConfirm(true);
        }}>{t('RESET_FACTORY')}</button>
      </Modal>

      <ConfirmDialog
        isOpen={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          clearAllState();
          window.location.reload();
        }}
        title={t('CONFIRM_RESET')}
        message={t('RESET_MSG')}
        confirmLabel={t('RESET_ALL')}
        variant="danger"
      />

      {/* Add Symbol Modal */}
      <Modal isOpen={showAddSymbolModal} onClose={() => setShowAddSymbolModal(false)} title={t('ADD_SYMBOL')} width="max-w-xs">
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
            {t('ADD_TO_WATCHLIST')}
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
                {t('LIVE_ORDER_TITLE')}
              </span>
            </div>
            <div className="p-5 font-mono text-sm space-y-3">
              <div className="flex justify-between text-gray-400">
                <span>{t('ACTION')}</span>
                <span className={pendingOrder.side === 'BUY' ? 'text-terminal-success font-bold' : 'text-terminal-error font-bold'}>
                  {pendingOrder.side}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('TH_SYMBOL')}</span>
                <span className="text-white font-bold">{pendingOrder.symbol}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('QUANTITY')}</span>
                <span className="text-white">{pendingOrder.quantity}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('PRICE')}</span>
                <span className="text-white">{pendingOrder.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400 border-t border-[#333] pt-2">
                <span>{t('TOTAL')}</span>
                <span className="text-terminal-accent font-bold">
                  {(pendingOrder.quantity * pendingOrder.price).toFixed(2)}
                </span>
              </div>
              <p className="text-red-400 text-[10px] pt-1">
                {t('LIVE_ORDER_WARNING')}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[#333]">
              <button
                onClick={cancelLiveOrder}
                className="py-3 text-xs font-bold text-gray-300 hover:bg-[#222] border-r border-[#333] uppercase tracking-widest"
              >
                {t('BTN_CANCEL')}
              </button>
              <button
                onClick={confirmLiveOrder}
                className="py-3 text-xs font-bold text-white bg-red-800 hover:bg-red-700 uppercase tracking-widest"
              >
                {t('CONFIRM_SEND')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
