import React from 'react';
import type { MarketMode } from '../types';
import type { LangKey } from '../constants/resources';

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
          <div className="flex space-x-1">
            <button onClick={() => setLang('EN')} className={`px-2 py-1 text-xs ${lang === 'EN' ? 'bg-terminal-accent text-black' : 'bg-[#222] text-gray-500'}`}>EN</button>
            <button onClick={() => setLang('CN')} className={`px-2 py-1 text-xs ${lang === 'CN' ? 'bg-terminal-accent text-black' : 'bg-[#222] text-gray-500'}`}>CN</button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">DEFAULT MARKET</span>
          <div className="flex space-x-1">
            <button onClick={() => setMarketMode('CRYPTO')} className={`px-2 py-1 text-xs ${marketMode === 'CRYPTO' ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-500'}`}>CRYPTO</button>
            <button onClick={() => setMarketMode('CN_STOCK')} className={`px-2 py-1 text-xs ${marketMode === 'CN_STOCK' ? 'bg-red-600 text-white' : 'bg-[#222] text-gray-500'}`}>A-SHARE</button>
          </div>
        </div>
        <div className="pt-4 border-t border-[#333]">
          <button className="w-full bg-[#333] hover:bg-[#444] py-2 text-xs text-white" onClick={() => localStorage.clear()}>RESET FACTORY SETTINGS</button>
        </div>
      </div>
    </div>
  </div>
);
