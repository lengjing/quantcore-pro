import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketMode, ColorScheme, AIProvider, AISettings, TradingMode } from '../types';
import type { AdapterCapability } from '../services/stock/IStockDataAdapter';
import { Select } from '../components/ui/Select';
import type { SelectOption } from '../components/ui/Select';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { clearAllState } from '../utils/storage';
import { FREE_CLAUDE_PROVIDER_OPTIONS, getDefaultModel, getProviderLabel, getProviderModelHints, normalizeAiSettings } from '../services/ai/aiConfig';

interface SettingsViewProps {
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  tradingMode: TradingMode;
  setTradingMode: (mode: TradingMode) => void;
  colorScheme: ColorScheme;
  setColorScheme: (cs: ColorScheme) => void;
  capMap: Record<string, string>;
  setCapMap: (v: Record<string, string>) => void;
  aiSettings: AISettings;
  setAiSettings: (v: AISettings | ((prev: AISettings) => AISettings)) => void;
}

const STOCK_ADAPTERS_BASE = [
  { value: 'eastmoney', labelEN: 'EastMoney', labelCN: '东方财富', activeColor: 'text-orange-400' },
  { value: 'tencent',   labelEN: 'Tencent',   labelCN: '腾讯财经', activeColor: 'text-blue-400' },
  { value: 'sina',      labelEN: 'Sina',       labelCN: '新浪财经', activeColor: 'text-red-400' },
  { value: 'baostock',  labelEN: 'BaoStock',   labelCN: 'BaoStock', activeColor: 'text-green-400' },
  { value: 'netease',   labelEN: 'NetEase',    labelCN: '网易财经', activeColor: 'text-purple-400' },
  { value: 'yahoo',     labelEN: 'Yahoo',      labelCN: 'Yahoo财经', activeColor: 'text-indigo-400' },
];

export const SettingsView = ({ marketMode, setMarketMode, tradingMode, setTradingMode, colorScheme, setColorScheme, capMap, setCapMap, aiSettings, setAiSettings }: SettingsViewProps) => {
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

  const handleProviderChange = useCallback((provider: AIProvider) => {
    setAiSettings((prev) => ({
      ...prev,
      provider,
      model: prev.model && prev.model !== getDefaultModel(prev.provider) ? prev.model : getDefaultModel(provider),
    }));
  }, [setAiSettings]);

  const providerOptions: SelectOption<AIProvider>[] = FREE_CLAUDE_PROVIDER_OPTIONS.map((provider) => ({
    value: provider.id,
    label: provider.label,
    activeColor: provider.local ? 'text-green-400' : 'text-terminal-accent',
  }));
  const currentProvider = FREE_CLAUDE_PROVIDER_OPTIONS.find((provider) => provider.id === aiSettings.provider) ?? FREE_CLAUDE_PROVIDER_OPTIONS[0];
  const modelHints = getProviderModelHints(aiSettings.provider).slice(0, 6);

  const marketOptions: SelectOption<MarketMode>[] = [
    { value: 'CRYPTO', label: 'CRYPTO', activeColor: 'text-blue-400' },
    { value: 'CN_STOCK', label: 'A-SHARE', activeColor: 'text-red-400' },
  ];

  const tradingOptions: SelectOption<TradingMode>[] = [
    { value: 'PAPER', label: 'PAPER', activeColor: 'text-gray-300' },
    { value: 'LIVE', label: 'LIVE', activeColor: 'text-red-400' },
  ];

  const languageOptions: SelectOption<'EN' | 'CN'>[] = [
    { value: 'EN', label: 'EN' },
    { value: 'CN', label: '中文' },
  ];

  const colorSchemeOptions: SelectOption<ColorScheme>[] = [
    { value: 'greenUp', label: t('COLOR_GREEN_RED'), activeColor: 'text-green-400' },
    { value: 'redUp', label: t('COLOR_RED_GREEN'), activeColor: 'text-red-400' },
  ];

  const stockAdapterOptions: SelectOption<string>[] = STOCK_ADAPTERS;

  return (
    <div className="flex h-full items-center justify-center overflow-auto">
      <div className="w-full max-w-5xl p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-[#333] bg-[#111] p-6 backdrop-blur-sm">
            <h2 className="text-terminal-accent font-bold mb-4 uppercase tracking-widest border-b border-[#333] pb-2">{t('CONFIGURATION')}</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">{t('SETUP_VERSION')}</span>
                <span className="text-gray-300 text-xs font-mono">v{__APP_VERSION__}</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">{t('INTERFACE_LANGUAGE')}</span>
                <Select
                  options={languageOptions}
                  value={currentLang}
                  onChange={handleLanguageChange}
                  size="sm"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">{t('DEFAULT_MARKET')}</span>
                <Select
                  options={marketOptions}
                  value={marketMode}
                  onChange={setMarketMode}
                  size="sm"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">Trading Mode</span>
                <Select
                  options={tradingOptions}
                  value={tradingMode}
                  onChange={setTradingMode}
                  size="sm"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <div>
                  <span className="text-gray-400 text-xs">{t('COLOR_SCHEME')}</span>
                  <p className="text-gray-600 text-[10px] mt-0.5">{t('COLOR_SCHEME_HINT')}</p>
                </div>
                <Select
                  options={colorSchemeOptions}
                  value={colorScheme}
                  onChange={setColorScheme}
                  size="sm"
                />
              </div>

              <div className="pt-2 border-t border-[#333]">
                <div className="mb-2">
                  <span className="text-gray-400 text-xs">{t('ASHARE_DATA_SOURCE')}</span>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-terminal-accent/30">
                  {(Object.keys(CAPABILITY_LABELS) as AdapterCapability[]).map((cap) => (
                    <div key={cap} className="flex justify-between items-center gap-3">
                      <span className="text-gray-500 text-[10px] font-mono">{CAPABILITY_LABELS[cap]}</span>
                      <Select
                        options={stockAdapterOptions}
                        value={capMap[cap]}
                        onChange={(id) => handleCapChange(cap, id)}
                        size="xs"
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
                <Select
                  options={providerOptions}
                  value={aiSettings.provider}
                  onChange={handleProviderChange}
                  size="sm"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">Provider Label</span>
                <span className="text-gray-300 text-[11px] font-mono">{getProviderLabel(aiSettings.provider)}</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">API Key</span>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, apiKey: e.target.value }))}
                  placeholder={currentProvider.credentialEnv ?? 'Optional local runtime key'}
                  className="w-60 bg-[#0c0c0c] border border-[#333] px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-terminal-accent"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-400 text-xs">Model</span>
                <input
                  list="free-claude-model-hints"
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, model: e.target.value }))}
                  placeholder={getDefaultModel(aiSettings.provider)}
                  className="w-60 bg-[#0c0c0c] border border-[#333] px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-terminal-accent font-mono"
                />
                <datalist id="free-claude-model-hints">
                  {[getDefaultModel(aiSettings.provider), ...modelHints].map((hint) => (
                    <option key={hint} value={hint} />
                  ))}
                </datalist>
              </div>

              <p className="text-[10px] text-gray-600 leading-relaxed">
                Settings are persisted locally. Packaged builds ignore .env and use runtime defaults plus your saved values.
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
