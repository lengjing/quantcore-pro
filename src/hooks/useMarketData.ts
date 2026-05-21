import { useState, useEffect, useRef, useCallback } from 'react';
import type { MarketTicker, CandleData, Trade, Timeframe } from '../types';
import type { MarketMode } from '../types';
import { fetchTopTickers, fetchKlines, fetchDepth, fetchRecentTrades } from '../services/crypto/binanceRestService';
import { fetchStockTickers, fetchStockKlines } from '../services/stock/stockDataService';
import { connectWebSocket } from '../services/crypto/binanceWsService';
import { enhanceCandlesWithIndicators } from '../utils/technicalIndicators';

const POLL_INTERVAL_MS = 5000;
const WS_RECONNECT_DELAY_MS = 3000;
const WS_MAX_RECONNECTS = 10;

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
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset market-specific state on mode switch
  useEffect(() => {
    setCandles([]);
    setDepth({ bids: [], asks: [] });
    setTrades([]);
  }, [marketMode]);

  // Fetch tickers + update depth for stock mode
  const updateMarketData = useCallback(async () => {
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
  }, [marketMode, activeSymbol]);

  // WebSocket + polling
  useEffect(() => {
    if (!activeSymbol) return;

    let wsCleanupFn: (() => void) | null = null;
    let stopped = false;

    const startWs = () => {
      if (stopped || marketMode !== 'CRYPTO') return;

      wsCleanupFn = connectWebSocket(activeSymbol, {
        trade: (trade) => setTrades((prev) => [trade, ...prev].slice(0, 100)),
        depth: (bids, asks) => {
          setDepth({ bids: bids.slice(0, 20), asks: asks.slice(0, 20) });
        },
        onClose: () => {
          if (stopped) return;
          if (reconnectCountRef.current < WS_MAX_RECONNECTS) {
            reconnectCountRef.current += 1;
            reconnectTimerRef.current = setTimeout(startWs, WS_RECONNECT_DELAY_MS);
          }
        },
      });
    };

    if (marketMode === 'CRYPTO') {
      reconnectCountRef.current = 0;
      // Load initial depth + trades via REST so panels are never empty
      fetchDepth(activeSymbol).then((d) => {
        if (!stopped) setDepth(d);
      });
      fetchRecentTrades(activeSymbol, 50).then((t) => {
        if (!stopped) setTrades(t);
      });
      startWs();
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
      stopped = true;
      wsCleanupFn?.();
      clearInterval(pollInterval);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
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
