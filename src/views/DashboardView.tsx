import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketMode, MarketTicker, CandleData, Trade, Position, Timeframe, OrderBookDepth, KlinePeriod } from '../types';
import { KLINE_PERIOD_TIMEFRAMES } from '../types';
import { Panel } from '../components/ui/Panel';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { Select } from '../components/ui/Select';
import { OrderTicket } from '../components/ui/OrderTicket';
import { SplitView } from '../components/ui/SplitView';
import MarketChart from '../components/MarketChart';
import OrderBook from '../components/OrderBook';
import { Plus, X } from 'lucide-react';

interface DashboardViewProps {
  marketMode: MarketMode;
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  candles: CandleData[];
  liveCandle: CandleData | null;
  depth: OrderBookDepth;
  trades: Trade[];
  positions: Position[];
  marketTickers: MarketTicker[];
  filteredTickers: MarketTicker[];
  currencySign: string;
  portfolioStats: { totalValue: number; totalPnL: number };
  removeFromWatchlist: (symbol: string) => void;
  setShowAddSymbolModal: (show: boolean) => void;
  executeTrade: (side: 'BUY' | 'SELL', qty: string, limitPrice: string | null) => void;
}

const TIMEFRAMES: Timeframe[] = ['1M', '5M', '15M', '1H', '4H', '1D'];

const KLINE_PERIODS: { value: KlinePeriod; labelKey: string }[] = [
  { value: 'realtime', labelKey: 'KLINE_REALTIME' },
  { value: 'daily', labelKey: 'KLINE_DAILY' },
  { value: 'weekly', labelKey: 'KLINE_WEEKLY' },
  { value: 'monthly', labelKey: 'KLINE_MONTHLY' },
];

/** Format number for detail panel display */
const fmtDetail = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtVolDetail = (n: number) =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(0);

export const DashboardView = ({
  marketMode,
  activeSymbol,
  setActiveSymbol,
  timeframe,
  setTimeframe,
  candles,
  liveCandle,
  depth,
  trades,
  positions,
  marketTickers,
  filteredTickers,
  currencySign,
  portfolioStats,
  removeFromWatchlist,
  setShowAddSymbolModal,
  executeTrade,
}: DashboardViewProps) => {
  const { t } = useTranslation();
  const { bids, asks } = depth;

  // Period-based timeframe management
  const [activePeriod, setActivePeriod] = useState<KlinePeriod>('realtime');
  // Candle detail panel state
  const [selectedCandle, setSelectedCandle] = useState<CandleData | null>(null);

  const handlePeriodChange = useCallback((period: KlinePeriod) => {
    setActivePeriod(period);
    const defaultTf = KLINE_PERIOD_TIMEFRAMES[period][0];
    setTimeframe(defaultTf);
  }, [setTimeframe]);

  const handleSubTimeframeChange = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
  }, [setTimeframe]);

  // Get sub-timeframes for current period
  const subTimeframes = KLINE_PERIOD_TIMEFRAMES[activePeriod];

  const handleCandleClick = useCallback((candle: CandleData) => {
    setSelectedCandle(candle);
  }, []);

  return (
    <div className="flex flex-col h-full gap-1">

      {/* ── Top section: Watchlist | Chart | OrderBook + Sales ──────── */}
      <SplitView direction="horizontal" initialSize={240} minSize={180} minSecondSize={400} persistKey="dash-main" className="flex-1 min-h-0">
        {/* Watchlist */}
        <Panel
          title={t('PNL_WATCHLIST')}
          className="h-full"
          tools={
            <button className="text-gray-400 hover:text-white p-1 hover:bg-[#222] rounded-sm mr-1" onClick={() => setShowAddSymbolModal(true)}>
              <Plus size={10} />
            </button>
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
                  const dirColor =
                    item.lastTickDir === 'UP' ? 'bg-green-900/40' :
                    item.lastTickDir === 'DOWN' ? 'bg-red-900/40' : '';
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
                      <td className="px-2 py-1 text-white">{item.price.toFixed(2)}</td>
                      <td className={`px-2 py-1 ${item.changePercent >= 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>
                        {item.changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                }) : (
                  <tr className="text-gray-600 text-center">
                    <td colSpan={3} className="py-4">{t('NO_WATCHLIST_DATA')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Chart + Right Panels */}
        <SplitView direction="horizontal" minSize={300} minSecondSize={200} persistKey="dash-chart-right" className="h-full">
          {/* Main Chart */}
          <Panel
            title={`${activeSymbol} ${marketMode === 'CN_STOCK' ? '(CNY)' : '(USDT)'}`}
            className="h-full"
            tools={
              <div className="flex items-center gap-2">
                {/* Period categories */}
                <ButtonGroup
                  options={KLINE_PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey as any) }))}
                  value={activePeriod}
                  onChange={handlePeriodChange}
                  variant="tab"
                />
                {/* Sub-timeframe selector (only for realtime which has multiple options) */}
                {subTimeframes.length > 1 && (
                  <>
                    <div className="h-3 w-px bg-[#333]" />
                    <Select
                      options={subTimeframes.map((tf) => ({ value: tf, label: tf }))}
                      value={timeframe}
                      onChange={handleSubTimeframeChange}
                      size="xs"
                    />
                  </>
                )}
              </div>
            }
          >
            <div className="flex h-full">
              <div className="flex-1 min-w-0">
                <MarketChart data={candles} symbol={activeSymbol} liveCandle={liveCandle} onCandleClick={handleCandleClick} />
              </div>
              {/* Candle Detail Panel */}
              {selectedCandle && (
                <div className="w-48 shrink-0 bg-[#0a0a0a] border-l border-[#1a1a1a] p-2 font-mono text-[10px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-terminal-accent font-bold text-[9px] tracking-wider">{t('KLINE_DETAIL_TITLE' as any)}</span>
                    <button
                      onClick={() => setSelectedCandle(null)}
                      className="text-gray-600 hover:text-white p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div className="text-gray-500 text-[9px] mb-2 pb-1 border-b border-[#222]">
                    {new Date(selectedCandle.time).toLocaleString()}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_OPEN' as any)}</span>
                      <span className="text-gray-300">{fmtDetail(selectedCandle.open)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_HIGH' as any)}</span>
                      <span className="text-terminal-success">{fmtDetail(selectedCandle.high)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_LOW' as any)}</span>
                      <span className="text-terminal-error">{fmtDetail(selectedCandle.low)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_CLOSE' as any)}</span>
                      <span className={selectedCandle.close >= selectedCandle.open ? 'text-terminal-success' : 'text-terminal-error'}>
                        {fmtDetail(selectedCandle.close)}
                      </span>
                    </div>
                    <div className="h-px bg-[#222] my-1" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_VOLUME' as any)}</span>
                      <span className="text-gray-300">{fmtVolDetail(selectedCandle.volume)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_CHANGE' as any)}</span>
                      {(() => {
                        const pct = selectedCandle.open === 0 ? 0 : ((selectedCandle.close - selectedCandle.open) / selectedCandle.open) * 100;
                        return (
                          <span className={pct >= 0 ? 'text-terminal-success' : 'text-terminal-error'}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('KLINE_AMPLITUDE' as any)}</span>
                      <span className="text-gray-300">
                        {selectedCandle.low === 0 ? '0.00' : (((selectedCandle.high - selectedCandle.low) / selectedCandle.low) * 100).toFixed(2)}%
                      </span>
                    </div>
                    {/* MA values if available */}
                    {selectedCandle.ma7 != null && (
                      <div className="flex justify-between">
                        <span className="text-[#f5c842]">MA7</span>
                        <span className="text-gray-300">{fmtDetail(selectedCandle.ma7)}</span>
                      </div>
                    )}
                    {selectedCandle.ma25 != null && (
                      <div className="flex justify-between">
                        <span className="text-[#e040fb]">MA25</span>
                        <span className="text-gray-300">{fmtDetail(selectedCandle.ma25)}</span>
                      </div>
                    )}
                    {selectedCandle.ma99 != null && (
                      <div className="flex justify-between">
                        <span className="text-[#00bcd4]">MA99</span>
                        <span className="text-gray-300">{fmtDetail(selectedCandle.ma99)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Right side: Order Book + Time & Sales */}
          <SplitView direction="vertical" minSize={100} minSecondSize={80} persistKey="dash-depth-sales" className="h-full">
            <Panel title={t('PNL_DEPTH')} className="h-full">
              <OrderBook bids={bids} asks={asks} />
            </Panel>

            <Panel title={t('PNL_SALES')} className="h-full">
              <div className="flex-1 overflow-hidden flex flex-col font-mono text-[10px]">
                <div className="flex justify-between px-2 py-1 text-gray-500 bg-[#111] border-b border-[#333]">
                  <span>{t('LABEL_PRICE')}</span>
                  <span>{t('LABEL_QTY')}</span>
                  <span>{t('TIME')}</span>
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
          </SplitView>
        </SplitView>
      </SplitView>

      {/* ── Bottom section: Portfolio + Order Ticket ────────────────── */}
      <SplitView direction="horizontal" minSize={300} minSecondSize={200} persistKey="dash-bottom" className="h-48 shrink-0">
        {/* Portfolio */}
        <Panel title={t('PNL_PORTFOLIO')} className="h-full">
          <div className="h-full flex">
            <div className="w-56 border-r border-terminal-border p-2 space-y-3 bg-[#080808] shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">{t('NAV_LABEL')}</span>
                <span className="text-lg font-mono text-white">
                  {currencySign}{portfolioStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">{t('DAY_PNL')}</span>
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

        {/* Order Ticket */}
        <Panel title={t('PNL_ORDER')} className="h-full">
          <OrderTicket
            symbol={activeSymbol}
            price={marketTickers.find((ticker) => ticker.symbol === activeSymbol)?.price}
            onTrade={executeTrade}
          />
        </Panel>
      </SplitView>
    </div>
  );
};
