import { useState } from 'react';
import type { MarketMode, Notification } from '../types';

type ShowNotification = (type: Notification['type'], message: string) => void;

export function useWatchlist(marketMode: MarketMode, showNotification: ShowNotification) {
  const [cryptoWatchlist, setCryptoWatchlist] = useState<string[]>([]);
  const [stockWatchlist, setStockWatchlist] = useState<string[]>([]);

  const currentWatchlist = marketMode === 'CRYPTO' ? cryptoWatchlist : stockWatchlist;

  const addToWatchlist = (symbol: string) => {
    const sym = marketMode === 'CRYPTO' ? symbol.toUpperCase() : symbol.toLowerCase();
    if (marketMode === 'CRYPTO') {
      if (!cryptoWatchlist.includes(sym)) {
        setCryptoWatchlist((prev) => [...prev, sym]);
        showNotification('SUCCESS', `ADDED ${sym} TO WATCHLIST`);
      }
    } else {
      if (!stockWatchlist.includes(sym)) {
        setStockWatchlist((prev) => [...prev, sym]);
        showNotification('SUCCESS', `ADDED ${sym} TO WATCHLIST`);
      }
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    if (marketMode === 'CRYPTO') {
      setCryptoWatchlist((prev) => prev.filter((s) => s !== symbol));
    } else {
      setStockWatchlist((prev) => prev.filter((s) => s !== symbol));
    }
    showNotification('INFO', `REMOVED ${symbol}`);
  };

  return {
    cryptoWatchlist,
    stockWatchlist,
    currentWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  };
}
