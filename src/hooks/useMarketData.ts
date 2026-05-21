import { useState, useEffect, useRef } from 'react';
import type { MarketTicker, CandleData, Trade, Timeframe } from '../types';
import type { MarketMode } from '../types';
import { fetchTopTickers, fetchKlines, fetchDepth } from '../services/crypto/binanceRestService';
import { fetchStockTickers, fetchStockKlines } from '../services/stock/stockDataService';
import { connectWebSocket } from '../services/crypto/binanceWsService';
import { enhanceCandlesWithIndicators } from '../utils/technicalIndicators';

const POLL_INTERVAL_MS = 5000;

export function useMarketData(
  activeSymbol: string,
  marketMode: MarketMode,
  timeframe: Timeframe,
) {
  const [marketTickers, setMarketTickers] = useState<MarketTicker[]>([]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [depth, setDepth] = useState<{ bids: any[]; asks: any[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isScannerLoading, setIsScannerLoading] = useState(false);

  const prevTickersRef = useRef<Record<string, number>>({});

  // Reset market-specific state on mode switch
  useEffect(() => {
    setCandles([]);
    setDepth({ bids: [], asks: [] });
    setTrades([]);
  }, [marketMode]);

  // Fetch tickers + update depth for stock mode
  const updateMarketData = async () => {
    setIsScannerLoading(true);
    const tickers: MarketTicker[] =
      marketMode === 'CRYPTO' ? await fetchTopTickers() : await fetchStockTickers();

    if (tickers.length > 0) {
      setMarketTickers(() => {
        return tickers.map((t) => {
          const prevPrice = prevTickersRef.current[t.symbol];
          let lastTickDir: 'UP' | 'DOWN' | 'NONE' = 'NONE';
          if (prevPrice != null) {
            if (t.price > prevPrice) lastTickDir = 'UP';
            else if (t.price < prevPrice) lastTickDir = 'DOWN';
          }
          prevTickersRef.current[t.symbol] = t.price;
          return { ...t, lastTickDir };
        });
      });

      if (marketMode === 'CN_STOCK') {
        const currentTicker = tickers.find((t) => t.symbol === activeSymbol);
        if (currentTicker?.bid && currentTicker?.ask) {
          setDepth({
            bids: [{ price: currentTicker.bid, size: currentTicker.bidSize ?? 100 }],
            asks: [{ price: currentTicker.ask, size: currentTicker.askSize ?? 100 }],
          });
        }
      }
    }
    setIsScannerLoading(false);
  };

  // WebSocket + polling
  useEffect(() => {
    if (!activeSymbol) return;

    let wsCleanup: (() => void) | null = null;

    if (marketMode === 'CRYPTO') {
      wsCleanup = connectWebSocket(activeSymbol, {
        trade: (trade) => setTrades((prev) => [trade, ...prev].slice(0, 50)),
        depth: (bids, asks) => setDepth({ bids: bids.slice(0, 20), asks: asks.slice(0, 20) }),
      });
    }

    const pollInterval = setInterval(async () => {
      updateMarketData();
      const latestCandles =
        marketMode === 'CRYPTO'
          ? await fetchKlines(activeSymbol, timeframe)
          : await fetchStockKlines(activeSymbol, timeframe);
      if (latestCandles.length > 0) {
        setCandles(enhanceCandlesWithIndicators(latestCandles));
      }
    }, POLL_INTERVAL_MS);

    return () => {
      wsCleanup?.();
      clearInterval(pollInterval);
    };
  }, [activeSymbol, marketMode, timeframe]);

  // Initial history load
  useEffect(() => {
    if (!activeSymbol) return;
    const loadHistory = async () => {
      const data =
        marketMode === 'CRYPTO'
          ? await fetchKlines(activeSymbol, timeframe)
          : await fetchStockKlines(activeSymbol, timeframe);
      setCandles(enhanceCandlesWithIndicators(data));
      if (marketMode === 'CN_STOCK') setTrades([]);
    };
    loadHistory();
  }, [activeSymbol, timeframe, marketMode]);

  // Initial ticker load
  useEffect(() => {
    updateMarketData();
  }, [marketMode]);

  return { marketTickers, candles, depth, trades, isScannerLoading, updateMarketData };
}
