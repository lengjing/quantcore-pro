import React, { useState, useCallback } from 'react';
import type { MarketMode } from '../types';
import type { LangKey } from '../constants/resources';
import type { AdapterCapability } from '../services/stock/IStockDataAdapter';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { clearAllState } from '../utils/storage';
import stockDataService from '../services/stock/stockDataService';

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
  { value: 'baostock',  label: 'BaoStock', activeColor: 'text-green-400' },
];

const CAPABILITY_LABELS: Record<AdapterCapability, string> = {
  realtime: 'REALTIME QUOTES',
  dailyKlines: 'DAILY K-LINES',
  minuteKlines: 'MINUTE K-LINES',
};

export const SettingsView = ({ lang, setLang, marketMode, setMarketMode, stockAdapterId, setStockAdapter }: SettingsViewProps) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [multiAdapter, setMultiAdapter] = useState(stockDataService.isMultiAdapterMode());
  const [capMap, setCapMap] = useState(stockDataService.getCapabilityMap());

  const handleToggleMultiAdapter = useCallback(() => {
    const next = !multiAdapter;
    setMultiAdapter(next);
    stockDataService.setMultiAdapterMode(next);
  }, [multiAdapter]);

  const handleCapChange = useCallback((cap: AdapterCapability, adapterId: string) => {
    stockDataService.setCapabilityAdapter(cap, adapterId);
    setCapMap(stockDataService.getCapabilityMap());
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-[480px] p-6 border border-[#333] bg-[#111]">
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

          {/* Single adapter selector (backward compatible) */}
          {!multiAdapter && (
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
          )}

          {/* Multi-adapter toggle */}
          <div className="flex justify-between items-center pt-2 border-t border-[#333]">
            <div>
              <span className="text-gray-400 text-xs">MULTI-ADAPTER MODE</span>
              <p className="text-gray-600 text-[10px] mt-0.5">Assign different data sources per capability</p>
            </div>
            <button
              onClick={handleToggleMultiAdapter}
              className={`text-[10px] font-mono font-bold px-3 py-1 border transition-colors ${
                multiAdapter
                  ? 'bg-terminal-accent text-black border-terminal-accent'
                  : 'text-gray-500 border-[#333] hover:border-[#555] hover:text-gray-300'
              }`}
            >
              {multiAdapter ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Per-capability adapter assignment */}
          {multiAdapter && (
            <div className="space-y-2 pl-2 border-l-2 border-terminal-accent/30">
              {(Object.keys(CAPABILITY_LABELS) as AdapterCapability[]).map((cap) => (
                <div key={cap} className="flex justify-between items-center">
                  <span className="text-gray-500 text-[10px] font-mono">{CAPABILITY_LABELS[cap]}</span>
                  <ButtonGroup
                    options={STOCK_ADAPTERS}
                    value={capMap[cap]}
                    onChange={(id: string) => handleCapChange(cap, id)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-[#333]">
            <button
              className="w-full bg-[#333] hover:bg-[#444] py-2 text-xs text-white"
              onClick={() => setShowResetConfirm(true)}
            >
              RESET FACTORY SETTINGS
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          clearAllState();
          window.location.reload();
        }}
        title="CONFIRM RESET"
        message="Reset all settings and data to factory defaults? This action cannot be undone."
        confirmLabel="RESET ALL"
        variant="danger"
      />
    </div>
  );
};
