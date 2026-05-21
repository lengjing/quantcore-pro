import React from 'react';
import type { CandleData, Trade, MarketMode } from '../types';
import { Panel } from '../components/ui/Panel';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import MarketChart from '../components/MarketChart';
import OrderBook from '../components/OrderBook';

const STOCK_ADAPTERS = [
  { value: 'eastmoney', label: 'EM' },
  { value: 'tencent', label: 'TX' },
  { value: 'sina', label: 'SINA' },
];

interface MarketViewProps {
  activeSymbol: string;
  candles: CandleData[];
  liveCandle: CandleData | null;
  depth: { bids: any[]; asks: any[] };
  trades: Trade[];
  marketMode: MarketMode;
  stockAdapterId: string;
  setStockAdapter: (id: string) => void;
}

export const MarketView = ({
  activeSymbol,
  candles,
  liveCandle,
  depth,
  trades,
  marketMode,
  stockAdapterId,
  setStockAdapter,
}: MarketViewProps) => (
  <div className="grid grid-cols-12 grid-rows-12 gap-1 h-full">
    <Panel
      title={`${activeSymbol} - TECHNICAL ANALYSIS`}
      className="col-span-9 row-span-12"
      tools={
        marketMode === 'CN_STOCK' ? (
          <ButtonGroup
            options={STOCK_ADAPTERS}
            value={stockAdapterId}
            onChange={setStockAdapter}
            variant="ghost"
            size="xs"
          />
        ) : undefined
      }
    >
      <MarketChart data={candles} symbol={activeSymbol} liveCandle={liveCandle} />
    </Panel>
    <div className="col-span-3 row-span-12 flex flex-col gap-1">
      <Panel title="DEPTH" className="flex-1">
        <OrderBook bids={depth.bids} asks={depth.asks} />
      </Panel>
      <Panel title="TAPE" className="flex-1">
        <div className="overflow-auto h-full font-mono text-[10px]">
          {trades.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
              <span className="text-gray-600 tracking-wider uppercase">Awaiting trades…</span>
            </div>
          ) : (
            trades.map((trade) => (
              <div key={trade.id} className="flex justify-between px-2 py-0.5 hover:bg-[#222]">
                <span className={trade.isBuyerMaker ? 'text-terminal-error' : 'text-terminal-success'}>{trade.price.toFixed(2)}</span>
                <span className="text-gray-400">{trade.quantity.toFixed(4)}</span>
                <span className="text-gray-600">{new Date(trade.time).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  </div>
);
