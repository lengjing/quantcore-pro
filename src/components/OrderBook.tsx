import React, { useMemo } from 'react';

interface OrderBookProps {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
}

const OrderBook: React.FC<OrderBookProps> = ({ bids, asks }) => {
  const maxVolume = useMemo(() => {
    const allSizes = [...bids.map((b) => b.size), ...asks.map((a) => a.size)];
    return allSizes.length > 0 ? Math.max(...allSizes) : 1;
  }, [bids, asks]);

  const spread = bids.length > 0 && asks.length > 0 ? asks[0].price - bids[0].price : null;

  if (bids.length === 0 && asks.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#050505] text-[10px] font-mono select-none items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
        <span className="text-gray-600 tracking-wider uppercase">Awaiting depth data…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-[10px] font-mono select-none">
      <div className="flex justify-between px-2 py-1 text-gray-600 bg-[#0a0a0a] border-b border-terminal-border">
        <span>PRICE</span>
        <span>SIZE</span>
      </div>

      {/* Asks (Sells) — shown inverted so lowest ask is nearest the spread */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end pb-1">
        {asks.slice().reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="flex justify-between px-2 py-[1px] relative hover:bg-gray-900 cursor-pointer">
            <div
              className="absolute top-0 right-0 h-full bg-red-900/30 z-0"
              style={{ width: `${(ask.size / maxVolume) * 100}%` }}
            />
            <span className="text-terminal-error z-10">{ask.price.toFixed(2)}</span>
            <span className="text-gray-400 z-10">{ask.size.toFixed(4)}</span>
          </div>
        ))}
      </div>

      {/* Spread Indicator */}
      <div className="py-0.5 bg-[#111] text-center border-y border-terminal-border flex justify-center items-center space-x-2">
        <span className="text-gray-500">SPREAD</span>
        <span className="text-white font-bold">
          {spread != null ? spread.toFixed(2) : '—'}
        </span>
      </div>

      {/* Bids (Buys) */}
      <div className="flex-1 overflow-hidden pt-1">
        {bids.map((bid, i) => (
          <div key={`bid-${i}`} className="flex justify-between px-2 py-[1px] relative hover:bg-gray-900 cursor-pointer">
            <div
              className="absolute top-0 right-0 h-full bg-green-900/30 z-0"
              style={{ width: `${(bid.size / maxVolume) * 100}%` }}
            />
            <span className="text-terminal-success z-10">{bid.price.toFixed(2)}</span>
            <span className="text-gray-400 z-10">{bid.size.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook;
