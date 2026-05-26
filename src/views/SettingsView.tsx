import React, { useState, useCallback } from 'react';
import type { MarketMode, ColorScheme } from '../types';
import type { LangKey, ResourceKey } from '../constants/resources';
import { RESOURCES } from '../constants/resources';
import type { AdapterCapability } from '../services/stock/IStockDataAdapter';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { clearAllState } from '../utils/storage';

interface SettingsViewProps {
  lang: LangKey;
  setLang: (lang: LangKey) => void;
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  stockAdapterId: string;
  setStockAdapter: (id: string) => void;
  colorScheme: ColorScheme;
  setColorScheme: (cs: ColorScheme) => void;
  multiAdapter: boolean;
  setMultiAdapter: (v: boolean) => void;
  capMap: Record<string, string>;
  setCapMap: (v: Record<string, string>) => void;
}

const STOCK_ADAPTERS_BASE = [
  { value: 'eastmoney', labelEN: 'EastMoney', labelCN: '东方财富', activeColor: 'text-orange-400' },
  { value: 'tencent',   labelEN: 'Tencent',   labelCN: '腾讯财经', activeColor: 'text-blue-400' },
  { value: 'sina',      labelEN: 'Sina',       labelCN: '新浪财经', activeColor: 'text-red-400' },
  { value: 'baostock',  labelEN: 'BaoStock',   labelCN: 'BaoStock', activeColor: 'text-green-400' },
];

export const SettingsView = ({ lang, setLang, marketMode, setMarketMode, stockAdapterId, setStockAdapter, colorScheme, setColorScheme, multiAdapter, setMultiAdapter, capMap, setCapMap }: SettingsViewProps) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const t = (key: ResourceKey): string => RESOURCES[lang][key];

  const STOCK_ADAPTERS = STOCK_ADAPTERS_BASE.map((a) => ({
    value: a.value,
    label: lang === 'CN' ? a.labelCN : a.labelEN,
    activeColor: a.activeColor,
  }));

  const CAPABILITY_LABELS: Record<AdapterCapability, string> = {
    realtime: t('CAP_REALTIME'),
    dailyKlines: t('CAP_DAILY'),
    minuteKlines: t('CAP_MINUTE'),
  };

  const handleToggleMultiAdapter = useCallback(() => {
    setMultiAdapter(!multiAdapter);
  }, [multiAdapter, setMultiAdapter]);

  const handleCapChange = useCallback((cap: AdapterCapability, adapterId: string) => {
    setCapMap({ ...capMap, [cap]: adapterId });
  }, [capMap, setCapMap]);

  return (
  <div className="flex h-full items-center justify-center overflow-auto">
      <div className="w-[480px] p-6 border border-[#333] bg-[#111]">
        <h2 className="text-terminal-accent font-bold mb-4 uppercase tracking-widest border-b border-[#333] pb-2">{t('CONFIGURATION')}</h2>
        <div className="space-y-4">

        {/* Version info */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">{t('SETUP_VERSION')}</span>
          <span className="text-gray-300 text-xs font-mono">v{__APP_VERSION__}</span>
        </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">{t('INTERFACE_LANGUAGE')}</span>
            <ButtonGroup
              options={[
                { value: 'EN', label: 'EN' },
                { value: 'CN', label: '中文' },
              ]}
              value={lang}
              onChange={setLang}
              size="sm"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs">{t('DEFAULT_MARKET')}</span>
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

          {/* Color scheme */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-400 text-xs">{t('COLOR_SCHEME')}</span>
              <p className="text-gray-600 text-[10px] mt-0.5">{t('COLOR_SCHEME_HINT')}</p>
            </div>
            <ButtonGroup
              options={[
                { value: 'greenUp', label: t('COLOR_GREEN_RED'), activeColor: 'text-green-400' },
                { value: 'redUp', label: t('COLOR_RED_GREEN'), activeColor: 'text-red-400' },
              ]}
              value={colorScheme}
              onChange={setColorScheme}
              size="sm"
            />
          </div>

          {/* Single adapter selector (backward compatible) */}
          {!multiAdapter && (
            <div className="flex justify-between items-center">
              <div>
                <span className="text-gray-400 text-xs">{t('ASHARE_DATA_SOURCE')}</span>
                <p className="text-gray-600 text-[10px] mt-0.5">{t('ASHARE_ACTIVE_HINT')}</p>
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
              <span className="text-gray-400 text-xs">{t('MULTI_ADAPTER_MODE')}</span>
              <p className="text-gray-600 text-[10px] mt-0.5">{t('MULTI_ADAPTER_HINT')}</p>
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
              {t('RESET_FACTORY')}
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
        title={t('CONFIRM_RESET')}
        message={t('RESET_MSG')}
        confirmLabel={t('RESET_ALL')}
        variant="danger"
      />
    </div>
  );
};
