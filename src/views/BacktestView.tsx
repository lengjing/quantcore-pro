import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { BacktestResult } from '../types';
import type { ResourceKey } from '../constants/resources';
import { Panel } from '../components/ui/Panel';

interface BacktestViewProps {
  backtestResult: BacktestResult | null;
  t: (key: ResourceKey) => string;
}

export const BacktestView = ({ backtestResult, t }: BacktestViewProps) => (
  <div className="h-full grid grid-cols-12 grid-rows-12 gap-1">
    <Panel title={t('PNL_PERF')} className="col-span-12 row-span-3">
      {backtestResult ? (
        <div className="flex h-full items-center justify-around">
          {backtestResult.metrics.map((m, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{m.label}</div>
              <div className="text-xl font-mono font-bold" style={{ color: m.color ?? 'white' }}>{m.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-gray-500">
          <div className="text-center">
            <Activity size={32} className="mx-auto mb-2 opacity-50" />
            {t('RUN_STRATEGY_HINT')}
          </div>
        </div>
      )}
    </Panel>

    <Panel title={t('EQUITY_CURVE')} className="col-span-12 row-span-6">
      {backtestResult ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={backtestResult.equityCurve}>
            <defs>
              <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff00" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00ff00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 10, fill: '#666' }} stroke="#333" />
            <Tooltip
              contentStyle={{ backgroundColor: '#000', borderColor: '#333', fontSize: '12px' }}
              itemStyle={{ color: '#00ff00' }}
              labelFormatter={(l) => new Date(String(l)).toLocaleDateString()}
            />
            <Area type="monotone" dataKey="value" stroke="#00ff00" fillOpacity={1} fill="url(#colorEq)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-gray-600">{t('NO_BACKTEST_DATA')}</div>
      )}
    </Panel>

    <Panel title={t('TRADE_LOG')} className="col-span-12 row-span-3">
      <div className="h-full overflow-auto font-mono text-xs">
        <table className="w-full text-right">
          <thead className="bg-[#111] text-gray-500 sticky top-0">
            <tr>
              <th className="p-2 text-left">{t('TIME')}</th>
              <th className="p-2">{t('SIDE')}</th>
              <th className="p-2">{t('PRICE')}</th>
              <th className="p-2">{t('TH_PNL')}</th>
            </tr>
          </thead>
          <tbody>
            {backtestResult?.trades.map((trade, i) => (
              <tr key={i} className="hover:bg-[#1a1a1a] border-b border-[#222]">
                <td className="p-2 text-left text-gray-400">{new Date(trade.time).toLocaleString()}</td>
                <td className={`p-2 ${trade.side === 'BUY' ? 'text-terminal-success' : 'text-terminal-error'}`}>{trade.side}</td>
                <td className="p-2 text-white">{trade.price.toFixed(2)}</td>
                <td className={`p-2 ${trade.pnl > 0 ? 'text-terminal-success' : trade.pnl < 0 ? 'text-terminal-error' : 'text-gray-500'}`}>
                  {trade.side === 'SELL' ? trade.pnl.toFixed(2) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  </div>
);
