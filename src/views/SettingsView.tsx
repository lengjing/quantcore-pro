import React from 'react';
import type { MarketMode } from '../types';
import type { LangKey } from '../constants/resources';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { clearAllState } from '../utils/storage';

interface SettingsViewProps {
  lang: LangKey;
  setLang: (lang: LangKey) => void;
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  stockAdapterId: string;
  setStockAdapter: (id: string) => void;
}

const STOCK_ADAPTERS = [
  { value: 'eastmoney', label: '东方财富', activeColor: 'text-orange-400' },
  { value: 'tencent',   label: '腾讯财经', activeColor: 'text-blue-400' },
  { value: 'sina',      label: '新浪财经', activeColor: 'text-red-400' },
];

export const SettingsView = ({ lang, setLang, marketMode, setMarketMode, stockAdapterId, setStockAdapter }: SettingsViewProps) => (
  <div className="flex h-full items-center justify-center">
    <div className="w-[420px] p-6 border border-[#333] bg-[#111]">
      <h2 className="text-terminal-accent font-bold mb-4 uppercase tracking-widest border-b border-[#333] pb-2">Configuration</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">INTERFACE LANGUAGE</span>
          <ButtonGroup
            options={[
              { value: 'EN', label: 'EN' },
              { value: 'CN', label: 'CN' },
            ]}
            value={lang}
            onChange={setLang}
            size="sm"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">DEFAULT MARKET</span>
          <ButtonGroup
            options={[
              { value: 'CRYPTO', label: 'CRYPTO', activeColor: 'text-blue-400' },
              { value: 'CN_STOCK', label: 'A-SHARE', activeColor: 'text-red-400' },
            ]}
            value={marketMode}
            onChange={setMarketMode}
            size="sm"
          />
        </div>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-400 text-xs">A-SHARE DATA SOURCE</span>
            <p className="text-gray-600 text-[10px] mt-0.5">Active when market mode is A-SHARE</p>
          </div>
          <ButtonGroup
            options={STOCK_ADAPTERS}
            value={stockAdapterId}
            onChange={setStockAdapter}
            size="sm"
          />
        </div>
        <div className="pt-4 border-t border-[#333]">
          <button
            className="w-full bg-[#333] hover:bg-[#444] py-2 text-xs text-white"
            onClick={() => {
              if (window.confirm('Reset all settings and data to factory defaults?')) {
                clearAllState();
                window.location.reload();
              }
            }}
          >
            RESET FACTORY SETTINGS
          </button>
        </div>
      </div>
    </div>
  </div>
);
