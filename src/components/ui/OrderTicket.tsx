import React, { useState, useEffect } from 'react';
import type { ResourceKey } from '../../constants/resources';

interface OrderTicketProps {
  symbol: string;
  price?: number;
  onTrade: (side: 'BUY' | 'SELL', qty: string, limitPrice: string | null) => void;
  t: (key: ResourceKey) => string;
}

export const OrderTicket = ({ symbol, price, onTrade, t }: OrderTicketProps) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [qty, setQty] = useState('0');
  const [limitPrice, setLimitPrice] = useState(price?.toFixed(2) ?? '0.00');

  useEffect(() => {
    if (price && parseFloat(limitPrice) === 0) setLimitPrice(price.toFixed(2));
  }, [price]);

  return (
    <div className="p-2 space-y-2 font-mono text-xs h-full flex flex-col">
      <div className="flex bg-[#111] border border-[#333] p-1 rounded-sm">
        <button
          className={`flex-1 py-1 font-bold ${side === 'BUY' ? 'bg-green-900 text-green-100' : 'text-gray-500 hover:bg-[#222]'}`}
          onClick={() => setSide('BUY')}
        >{t('BTN_BUY')}</button>
        <button
          className={`flex-1 py-1 font-bold ${side === 'SELL' ? 'bg-red-900 text-red-100' : 'text-gray-500 hover:bg-[#222]'}`}
          onClick={() => setSide('SELL')}
        >{t('BTN_SELL')}</button>
      </div>

      <div className="space-y-1">
        <label className="text-gray-500 text-[9px]">{t('ORDER_TYPE')}</label>
        <div className="flex space-x-2">
          <button
            className={`flex-1 border py-1 ${type === 'LIMIT' ? 'border-terminal-accent text-terminal-accent' : 'border-[#333] text-gray-500'}`}
            onClick={() => setType('LIMIT')}
          >{t('ORDER_LIMIT')}</button>
          <button
            className={`flex-1 border py-1 ${type === 'MARKET' ? 'border-terminal-accent text-terminal-accent' : 'border-[#333] text-gray-500'}`}
            onClick={() => setType('MARKET')}
          >{t('ORDER_MARKET')}</button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-gray-500 text-[9px]">{t('QUANTITY')}</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-right text-white focus:border-terminal-accent focus:outline-none"
        />
      </div>

      {type === 'LIMIT' && (
        <div className="space-y-1">
          <label className="text-gray-500 text-[9px]">{t('LIMIT_PRICE')}</label>
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-right text-white focus:border-terminal-accent focus:outline-none"
          />
        </div>
      )}

      <div className="pt-2 mt-auto">
        <button
          className={`w-full py-2 font-bold text-sm ${side === 'BUY' ? 'bg-terminal-success text-black' : 'bg-terminal-error text-white'}`}
          onClick={() => onTrade(side, qty, type === 'LIMIT' ? limitPrice : null)}
        >
          {side} {symbol.split('-')[0]}
        </button>
      </div>
    </div>
  );
};
