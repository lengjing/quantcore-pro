import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketMode, MarketTicker, CandleData, Trade, Position, Timeframe, OrderBookDepth } from '../types';
import { Panel } from '../components/ui/Panel';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { OrderTicket } from '../components/ui/OrderTicket';
import { SplitView } from '../components/ui/SplitView';
import MarketChart from '../components/MarketChart';
import OrderBook from '../components/OrderBook';
import { Plus } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full gap-1">

      {/* ── Top section: Watchlist | Chart | OrderBook + Sales ──────── */}
      <SplitView direction="horizontal" initialSize={240} minSize={180} minSecondSize={400} className="flex-1 min-h-0">
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
        <SplitView direction="horizontal" minSize={300} minSecondSize={200} className="h-full">
          {/* Main Chart */}
          <Panel
            title={`${activeSymbol} ${marketMode === 'CN_STOCK' ? '(CNY)' : '(USDT)'}`}
            className="h-full"
            tools={
              <ButtonGroup
                options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
                value={timeframe}
                onChange={setTimeframe}
                variant="tab"
              />
            }
          >
            <MarketChart data={candles} symbol={activeSymbol} liveCandle={liveCandle} />
          </Panel>

          {/* Right side: Order Book + Time & Sales */}
          <SplitView direction="vertical" minSize={100} minSecondSize={80} className="h-full">
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
      <SplitView direction="horizontal" minSize={300} minSecondSize={200} className="h-48 shrink-0">
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
