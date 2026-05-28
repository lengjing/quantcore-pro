import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketMode, ColorScheme, AISettings } from '../types';
import type { AdapterCapability } from '../services/stock/IStockDataAdapter';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { clearAllState } from '../utils/storage';
import { DEFAULT_FREE_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL, getDefaultModel } from '../services/ai/aiConfig';

interface SettingsViewProps {
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  colorScheme: ColorScheme;
  setColorScheme: (cs: ColorScheme) => void;
  capMap: Record<string, string>;
  setCapMap: (v: Record<string, string>) => void;
  aiSettings: AISettings;
  setAiSettings: (v: AISettings | ((prev: AISettings) => AISettings)) => void;
  vitePort: number;
  freeClaudePort: number;
}

const STOCK_ADAPTERS_BASE = [
  { value: 'eastmoney', labelEN: 'EastMoney', labelCN: '东方财富', activeColor: 'text-orange-400' },
  { value: 'tencent',   labelEN: 'Tencent',   labelCN: '腾讯财经', activeColor: 'text-blue-400' },
  { value: 'sina',      labelEN: 'Sina',       labelCN: '新浪财经', activeColor: 'text-red-400' },
  { value: 'baostock',  labelEN: 'BaoStock',   labelCN: 'BaoStock', activeColor: 'text-green-400' },
  { value: 'netease',   labelEN: 'NetEase',    labelCN: '网易财经', activeColor: 'text-purple-400' },
  { value: 'yahoo',     labelEN: 'Yahoo',      labelCN: 'Yahoo财经', activeColor: 'text-indigo-400' },
];

export const SettingsView = ({ marketMode, setMarketMode, colorScheme, setColorScheme, capMap, setCapMap, aiSettings, setAiSettings, vitePort, freeClaudePort }: SettingsViewProps) => {
  const { t, i18n } = useTranslation();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const STOCK_ADAPTERS = STOCK_ADAPTERS_BASE.map((a) => ({
    value: a.value,
    label: i18n.language === 'cn' ? a.labelCN : a.labelEN,
    activeColor: a.activeColor,
  }));

  const currentLang = i18n.language === 'cn' ? 'CN' : 'EN';

  const handleLanguageChange = useCallback((nextLang: 'EN' | 'CN') => {
    void i18n.changeLanguage(nextLang === 'CN' ? 'cn' : 'en');
    try {
      localStorage.setItem('qcp:lang', JSON.stringify(nextLang));
    } catch {
      // Ignore persistence failures.
    }
  }, [i18n]);

  const CAPABILITY_LABELS: Record<AdapterCapability, string> = {
    realtime: t('CAP_REALTIME'),
    dailyKlines: t('CAP_DAILY'),
    minuteKlines: t('CAP_MINUTE'),
  };

  const handleCapChange = useCallback((cap: AdapterCapability, adapterId: string) => {
    setCapMap({ ...capMap, [cap]: adapterId });
  }, [capMap, setCapMap]);

  const handleProviderChange = useCallback((provider: AISettings['provider']) => {
    setAiSettings((prev) => ({
      ...prev,
      provider,
      model: prev.model && prev.model !== getDefaultModel(prev.provider) ? prev.model : getDefaultModel(provider),
    }));
  }, [setAiSettings]);

  const aiModelPlaceholder = aiSettings.provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_FREE_CLAUDE_MODEL;

  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,_rgba(255,153,0,0.08),_transparent_35%),linear-gradient(180deg,_#090909_0%,_#111_100%)]">
      <div className="w-full max-w-5xl p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-[#333] bg-[#111] p-6 backdrop-blur-sm">
            <h2 className="text-terminal-accent font-bold mb-4 uppercase tracking-widest border-b border-[#333] pb-2">{t('CONFIGURATION')}</h2>
            <div className="space-y-4">
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
                  value={currentLang}
                  onChange={handleLanguageChange}
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
              <div className="pt-2 border-t border-[#333]">
                <div className="mb-2">
                  <span className="text-gray-400 text-xs">{t('ASHARE_DATA_SOURCE')}</span>
                  <p className="text-gray-600 text-[10px] mt-0.5">{t('MULTI_ADAPTER_HINT')}</p>
                </div>
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
              </div>
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

          <div className="border border-[#333] bg-[#111] p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-terminal-accent font-bold uppercase tracking-widest border-b border-[#333] pb-2">AI Runtime</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">Provider</span>
                <ButtonGroup
                  options={[
                    { value: 'free-claude-code', label: 'free-claude-code', activeColor: 'text-terminal-accent' },
                    { value: 'gemini', label: 'Gemini', activeColor: 'text-blue-400' },
                  ]}
                  value={aiSettings.provider}
                  onChange={handleProviderChange}
                  size="sm"
                />
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">API Key</span>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                  placeholder={aiSettings.provider === 'gemini' ? 'Gemini API key' : 'DeepSeek API key'}
                  className="w-60 bg-[#0c0c0c] border border-[#333] px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-terminal-accent"
                />
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">Model</span>
                <input
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  placeholder={aiModelPlaceholder}
                  className="w-60 bg-[#0c0c0c] border border-[#333] px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-terminal-accent font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-mono">
                <div className="border border-[#222] bg-[#0c0c0c] px-3 py-2">
                  <div className="uppercase tracking-widest text-gray-600">VITE_PORT</div>
                  <div className="text-gray-300 mt-1">{vitePort}</div>
                </div>
                <div className="border border-[#222] bg-[#0c0c0c] px-3 py-2">
                  <div className="uppercase tracking-widest text-gray-600">FREE_CLAUDE_PORT</div>
                  <div className="text-gray-300 mt-1">{freeClaudePort}</div>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 leading-relaxed">
                The selected provider and model are persisted locally. The runtime key is read from this panel first, then from .env/test when available.
              </p>
            </div>
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
