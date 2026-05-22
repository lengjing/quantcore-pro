import { useState } from 'react';
import type { CandleData, BacktestResult, StrategyFile, Notification } from '../types';

type ShowNotification = (type: Notification['type'], message: string) => void;

export function useBacktest(
  candles: CandleData[],
  strategyFiles: StrategyFile[],
  activeFileName: string,
  showNotification: ShowNotification,
) {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  const runBacktest = () => {
    if (candles.length < 50) {
      showNotification('ERROR', 'NOT ENOUGH DATA FOR BACKTEST');
      return;
    }

    const initialCapital = 10000;
    let cash = initialCapital;
    let holdings = 0;
    const equityCurve: { time: string; value: number }[] = [];
    const trades: { time: string; side: 'BUY' | 'SELL'; price: number; pnl: number }[] = [];

    candles.forEach((candle) => {
      if (!candle.ma25) return;

      const price = candle.close;
      const ma = candle.ma25;
      const date = candle.time;

      if (price > ma && holdings === 0) {
        holdings = cash / price;
        cash = 0;
        trades.push({ time: date, side: 'BUY', price, pnl: 0 });
      } else if (price < ma && holdings > 0) {
        const proceed = holdings * price;
        const entryPrice = trades[trades.length - 1].price;
        const pnl = proceed - holdings * entryPrice;
        cash = proceed;
        holdings = 0;
        trades.push({ time: date, side: 'SELL', price, pnl });
      }

      equityCurve.push({ time: date, value: cash + holdings * price });
    });

    const finalValue = equityCurve[equityCurve.length - 1]?.value ?? initialCapital;
    const returnPct = ((finalValue - initialCapital) / initialCapital) * 100;
    const sellTrades = trades.filter((t) => t.side === 'SELL');
    const winRate =
      sellTrades.length > 0
        ? (sellTrades.filter((t) => t.pnl > 0).length / sellTrades.length) * 100
        : 0;

    setBacktestResult({
      equityCurve,
      trades,
      metrics: [
        { label: 'TOTAL RETURN', value: `${returnPct.toFixed(2)}%`, color: returnPct >= 0 ? '#00ff00' : '#ff0000' },
        { label: 'FINAL EQUITY', value: `$${finalValue.toFixed(2)}` },
        { label: 'WIN RATE', value: `${winRate.toFixed(1)}%` },
        { label: 'TOTAL TRADES', value: sellTrades.length.toString() },
      ],
    });

    showNotification('SUCCESS', 'BACKTEST COMPLETED');
  };

  return { backtestResult, setBacktestResult, runBacktest };
}
