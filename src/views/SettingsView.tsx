import React from 'react';
import type { MarketMode } from '../types';
import type { LangKey } from '../constants/resources';
import { ButtonGroup } from '../components/ui/ButtonGroup';

interface SettingsViewProps {
  lang: LangKey;
  setLang: (lang: LangKey) => void;
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
}

export const SettingsView = ({ lang, setLang, marketMode, setMarketMode }: SettingsViewProps) => (
  <div className="flex h-full items-center justify-center">
    <div className="w-96 p-6 border border-[#333] bg-[#111]">
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
            variant="accent"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">DEFAULT MARKET</span>
          <ButtonGroup
            options={[
              { value: 'CRYPTO', label: 'CRYPTO', activeClass: 'bg-blue-600' },
              { value: 'CN_STOCK', label: 'A-SHARE', activeClass: 'bg-red-600' },
            ]}
            value={marketMode}
            onChange={setMarketMode}
          />
        </div>
        <div className="pt-4 border-t border-[#333]">
          <button className="w-full bg-[#333] hover:bg-[#444] py-2 text-xs text-white" onClick={() => localStorage.clear()}>RESET FACTORY SETTINGS</button>
        </div>
      </div>
    </div>
  </div>
);
