import { useState, useEffect, useRef, useCallback } from 'react';
import type { MarketTicker, CandleData, Trade, Timeframe, OrderBookDepth } from '../types';
import type { MarketMode } from '../types';
import { fetchTopTickers, fetchKlines, fetchDepth, fetchRecentTrades } from '../services/crypto/binanceRestService';
import { fetchStockTickers, fetchStockKlines } from '../services/stock/stockDataService';
import stockDataService from '../services/stock/stockDataService';
import { connectWebSocket } from '../services/crypto/binanceWsService';
import { enhanceCandlesWithIndicators } from '../utils/technicalIndicators';

const TICKER_POLL_MS = 5000;
const STOCK_CANDLE_POLL_MS = 5000;
const WS_RECONNECT_DELAY_MS = 3000;
const WS_MAX_RECONNECTS = 10;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export function useMarketData(
  activeSymbol: string,
  marketMode: MarketMode,
  timeframe: Timeframe,
  stockAdapterId: string,
) {
  const [marketTickers, setMarketTickers] = useState<MarketTicker[]>([]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [liveCandle, setLiveCandle] = useState<CandleData | null>(null);
  const [depth, setDepth] = useState<OrderBookDepth>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isScannerLoading, setIsScannerLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const prevTickersRef = useRef<Record<string, number>>({});
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply adapter switch immediately so subsequent fetches use the new adapter.
  useEffect(() => {
    if (marketMode === 'CN_STOCK') {
      try {
        stockDataService.setActiveAdapter(stockAdapterId);
      } catch (e) {
        console.warn('setActiveAdapter:', e);
      }
    }
  }, [stockAdapterId, marketMode]);

  // Reset market-specific state on mode/symbol/timeframe switch
  useEffect(() => {
    setCandles([]);
    setLiveCandle(null);
    setDepth({ bids: [], asks: [] });
    setTrades([]);
  }, [marketMode, activeSymbol, timeframe]);

  // Fetch tickers + update depth for stock mode
  const updateMarketData = useCallback(async () => {
    setIsScannerLoading(true);
    const fetchStart = performance.now();
    try {
      const tickers: MarketTicker[] =
        marketMode === 'CRYPTO' ? await fetchTopTickers() : await fetchStockTickers();
      const elapsed = Math.round(performance.now() - fetchStart);
      setLatencyMs(elapsed);

      if (tickers.length > 0) {
        setConnectionStatus('connected');
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
    } catch (err) {
      console.warn('Market data fetch failed:', err);
      setConnectionStatus('disconnected');
    }
    setIsScannerLoading(false);
  }, [marketMode, activeSymbol]);

  // ── CRYPTO: WebSocket for trades, depth, and live kline ──────────────────
  useEffect(() => {
    if (!activeSymbol || marketMode !== 'CRYPTO') return;

    let stopped = false;
    let wsCleanupFn: (() => void) | null = null;
    reconnectCountRef.current = 0;

    const startWs = () => {
      if (stopped) return;
      setConnectionStatus('connecting');

      wsCleanupFn = connectWebSocket(activeSymbol, timeframe, {
        trade: (trade) => {
          setConnectionStatus('connected');
          setTrades((prev) => [trade, ...prev].slice(0, 100));
        },
        depth: (bids, asks) => {
          setDepth({ bids: bids.slice(0, 20), asks: asks.slice(0, 20) });
        },
        kline: (candle) => {
          if (!stopped) setLiveCandle(candle);
        },
        onClose: () => {
          if (stopped) return;
          setConnectionStatus('disconnected');
          if (reconnectCountRef.current < WS_MAX_RECONNECTS) {
            reconnectCountRef.current += 1;
            reconnectTimerRef.current = setTimeout(startWs, WS_RECONNECT_DELAY_MS);
          }
        },
      });
    };

    // REST pre-fetch so panels are never blank before WS connects
    fetchDepth(activeSymbol).then((d) => { if (!stopped) setDepth(d); }).catch(console.warn);
    fetchRecentTrades(activeSymbol, 50).then((t) => { if (!stopped) setTrades(t); }).catch(console.warn);
    startWs();

    // Ticker polling only — klines come from WS
    const tickerPoll = setInterval(() => updateMarketData(), TICKER_POLL_MS);

    return () => {
      stopped = true;
      wsCleanupFn?.();
      clearInterval(tickerPoll);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [activeSymbol, marketMode, timeframe]);

  // ── STOCK: polling for tickers + candles ─────────────────────────────────
  useEffect(() => {
    if (!activeSymbol || marketMode !== 'CN_STOCK') return;

    let stopped = false;

    const poll = async () => {
      updateMarketData();
      const latestCandles = await fetchStockKlines(activeSymbol, timeframe);
      if (!stopped && latestCandles.length > 0) {
        setCandles(enhanceCandlesWithIndicators(latestCandles));
      }
    };

    poll();
    const interval = setInterval(poll, STOCK_CANDLE_POLL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [activeSymbol, marketMode, timeframe, stockAdapterId]);

  // ── Initial history load (both modes) ────────────────────────────────────
  useEffect(() => {
    if (!activeSymbol) return;
    const loadHistory = async () => {
      const data =
        marketMode === 'CRYPTO'
          ? await fetchKlines(activeSymbol, timeframe)
          : await fetchStockKlines(activeSymbol, timeframe);
      setCandles(enhanceCandlesWithIndicators(data));
      setLiveCandle(null);
      if (marketMode === 'CN_STOCK') setTrades([]);
    };
    loadHistory();
  }, [activeSymbol, timeframe, marketMode, stockAdapterId]);

  // ── Initial ticker load ───────────────────────────────────────────────────
  useEffect(() => {
    updateMarketData();
  }, [marketMode, stockAdapterId]);

  return { marketTickers, candles, liveCandle, depth, trades, isScannerLoading, updateMarketData, connectionStatus, latencyMs };
}
