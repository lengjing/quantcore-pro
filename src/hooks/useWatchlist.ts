import type { MarketMode, Notification } from '../types';
import { usePersisted } from './usePersisted';
import { DEFAULT_STOCK_SYMBOLS } from '../services/stock/stockDataService';

type ShowNotification = (type: Notification['type'], message: string) => void;

const DEFAULT_CRYPTO_WATCHLIST = ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT', 'XRP-USDT'];
const DEFAULT_STOCK_WATCHLIST = [
  'sh600519', 'sz000858', 'sh601318', 'sz300750', 'sh600036',
  ...DEFAULT_STOCK_SYMBOLS.slice(0, 5),
].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10) as string[];

export function useWatchlist(marketMode: MarketMode, showNotification: ShowNotification) {
  const [cryptoWatchlist, setCryptoWatchlist] = usePersisted<string[]>(
    'cryptoWatchlist',
    DEFAULT_CRYPTO_WATCHLIST,
  );
  const [stockWatchlist, setStockWatchlist] = usePersisted<string[]>(
    'stockWatchlist',
    DEFAULT_STOCK_WATCHLIST,
  );

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
