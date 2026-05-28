import { useState, useEffect, useCallback } from 'react';
import { usePersisted } from './usePersisted';
import type { Position, CandleData, MarketTicker, TradingMode, Notification } from '../types';

type ShowNotification = (type: Notification['type'], message: string) => void;

/** An order awaiting live-mode user confirmation. */
export interface PendingOrder {
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  symbol: string;
}

/**
 * Professional trade engine hook.
 *
 * Responsibilities:
 * - Persists positions and trading mode across page reloads (via localStorage).
 * - Marks positions to market every time `marketTickers` changes.
 * - In PAPER mode: immediately executes simulated orders.
 * - In LIVE mode: stages a `pendingOrder` and waits for explicit confirmation
 *   before applying; caller is responsible for rendering the confirmation UI.
 */
export function useTradeEngine(
  activeSymbol: string,
  marketTickers: MarketTicker[],
  candles: CandleData[],
  showNotification: ShowNotification,
  tradingMode: TradingMode,
) {
  const [positions, setPositions] = usePersisted<Position[]>('positions', []);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  // ── Mark-to-market ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (marketTickers.length === 0) return;
    setPositions((prev) =>
      prev.map((pos) => {
        const ticker = marketTickers.find((t) => t.symbol === pos.symbol);
        const currentPrice = ticker?.price ?? pos.currentPrice;
        const pnl = (currentPrice - pos.avgPrice) * pos.quantity;
        const pnlPercent =
          pos.avgPrice > 0 ? (pnl / (pos.avgPrice * pos.quantity)) * 100 : 0;
        return { ...pos, currentPrice, pnl, pnlPercent };
      }),
    );
  }, [marketTickers]);

  // ── Internal order application ──────────────────────────────────────────────
  const applyOrder = useCallback(
    (side: 'BUY' | 'SELL', quantity: number, price: number, symbol: string) => {
      setPositions((prev) => {
        const existing = prev.find((p) => p.symbol === symbol);
        if (existing) {
          if (side === 'BUY') {
            const totalCost = existing.quantity * existing.avgPrice + quantity * price;
            const newQty = existing.quantity + quantity;
            return prev.map((p) =>
              p.symbol === symbol
                ? { ...p, quantity: newQty, avgPrice: totalCost / newQty }
                : p,
            );
          } else {
            const newQty = existing.quantity - quantity;
            if (newQty <= 0.0001) return prev.filter((p) => p.symbol !== symbol);
            return prev.map((p) =>
              p.symbol === symbol ? { ...p, quantity: newQty } : p,
            );
          }
        }
        return [
          ...prev,
          {
            symbol,
            quantity,
            avgPrice: price,
            currentPrice: price,
            pnl: 0,
            pnlPercent: 0,
          },
        ];
      });
      const tag = tradingMode === 'LIVE' ? '[LIVE]' : '[SIM]';
      showNotification(
        'SUCCESS',
        `[${tag}] ${side} ${quantity} ${symbol} @ ${price.toFixed(2)}`,
      );
    },
    [tradingMode, setPositions, showNotification],
  );

  // ── Public: queue or immediately execute an order ───────────────────────────
  const executeTrade = useCallback(
    (side: 'BUY' | 'SELL', quantity: string, limitPrice: string | null) => {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        showNotification('ERROR', 'INVALID QTY');
        return;
      }
      const ticker = marketTickers.find((t) => t.symbol === activeSymbol);
      const price = limitPrice
        ? parseFloat(limitPrice)
        : (ticker?.price ?? candles[candles.length - 1]?.close ?? 0);

      if (tradingMode === 'LIVE') {
        // Stage for confirmation — caller must render the confirmation dialog.
        setPendingOrder({ side, quantity: qty, price, symbol: activeSymbol });
      } else {
        applyOrder(side, qty, price, activeSymbol);
      }
    },
    [activeSymbol, tradingMode, marketTickers, candles, applyOrder, showNotification],
  );

  /** Confirm the pending live order (execute it for real). */
  const confirmLiveOrder = useCallback(() => {
    if (!pendingOrder) return;
    applyOrder(
      pendingOrder.side,
      pendingOrder.quantity,
      pendingOrder.price,
      pendingOrder.symbol,
    );
    setPendingOrder(null);
  }, [pendingOrder, applyOrder]);

  /** Cancel the pending live order without executing. */
  const cancelLiveOrder = useCallback(() => {
    setPendingOrder(null);
    showNotification('INFO', 'ORDER CANCELLED');
  }, [showNotification]);

  return {
    tradingMode,
    positions,
    executeTrade,
    pendingOrder,
    confirmLiveOrder,
    cancelLiveOrder,
  };
}
