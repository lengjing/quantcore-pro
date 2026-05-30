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
  { value: 'tongdaxin', labelEN: 'Tongdaxin',  labelCN: '通达信',   activeColor: 'text-cyan-400' },
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
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_18%_18%,rgba(255,153,0,0.1),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(255,153,0,0.06),transparent_26%),linear-gradient(180deg,#050505,#000)]">
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <div className="mb-4 border border-[#2a2a2a] bg-[#090909]/95 px-4 py-3 shadow-[0_0_0_1px_rgba(255,153,0,0.08)_inset]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-terminal-accent font-bold text-sm uppercase tracking-[0.2em]">{t('CONFIGURATION')}</h2>
              <p className="mt-1 text-[10px] text-gray-500">System control surface for market, data adapters, and AI runtime.</p>
            </div>
            <div className="rounded border border-[#2c2c2c] bg-black px-3 py-1.5 text-right">
              <div className="text-[9px] text-gray-600 uppercase tracking-widest">{t('SETUP_VERSION')}</div>
              <div className="text-xs text-terminal-accent font-mono">v{__APP_VERSION__}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="border border-[#2a2a2a] bg-[#0a0a0a] p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,153,0,0.05)_inset]">
            <div className="mb-3 flex items-center justify-between border-b border-[#222] pb-2">
              <h3 className="text-[11px] uppercase tracking-[0.22em] text-terminal-accent">Terminal Preferences</h3>
              <span className="text-[10px] text-gray-600">Local profile</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <span className="text-gray-400 text-xs">{t('INTERFACE_LANGUAGE')}</span>
                <Select options={languageOptions} value={currentLang} onChange={handleLanguageChange} size="sm" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <span className="text-gray-400 text-xs">{t('DEFAULT_MARKET')}</span>
                <Select options={marketOptions} value={marketMode} onChange={setMarketMode} size="sm" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <span className="text-gray-400 text-xs">Trading Mode</span>
                <Select options={tradingOptions} value={tradingMode} onChange={setTradingMode} size="sm" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <div>
                  <span className="text-gray-400 text-xs">{t('COLOR_SCHEME')}</span>
                  <p className="mt-0.5 text-[10px] text-gray-600">{t('COLOR_SCHEME_HINT')}</p>
                </div>
                <Select options={colorSchemeOptions} value={colorScheme} onChange={setColorScheme} size="sm" />
              </div>
            </div>

            <div className="mt-5 border-t border-[#222] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-terminal-accent">{t('ASHARE_DATA_SOURCE')}</span>
                <span className="text-[10px] text-gray-600">Capability routing</span>
              </div>

              <div className="space-y-2 rounded border border-[#1d1d1d] bg-black/60 p-3">
                {(Object.keys(CAPABILITY_LABELS) as AdapterCapability[]).map((cap) => (
                  <div key={cap} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-[#1a1a1a] bg-[#0b0b0b] px-2.5 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-gray-500">{CAPABILITY_LABELS[cap]}</span>
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

            <div className="mt-5 border-t border-[#222] pt-4">
              <button
                className="w-full border border-[#3d1f12] bg-[#1a0d05] py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb278] hover:border-[#8a421e] hover:bg-[#2a1508]"
                onClick={() => setShowResetConfirm(true)}
              >
                {t('RESET_FACTORY')}
              </button>
            </div>
          </section>

          <section className="border border-[#2a2a2a] bg-[#0a0a0a] p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,153,0,0.05)_inset]">
            <div className="mb-3 flex items-center justify-between border-b border-[#222] pb-2">
              <h3 className="text-[11px] uppercase tracking-[0.22em] text-terminal-accent">AI Runtime</h3>
              <span className="text-[10px] text-gray-600">free-claude-code</span>
            </div>

            <div className="space-y-3">
              <div className="rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">Provider</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-300 font-mono truncate">{getProviderLabel(aiSettings.provider)}</span>
                  <Select options={providerOptions} value={aiSettings.provider} onChange={handleProviderChange} size="sm" />
                </div>
              </div>

              <div className="rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">API Key</div>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, apiKey: e.target.value }))}
                  placeholder={currentProvider.credentialEnv ?? 'Optional local runtime key'}
                  className="w-full bg-[#0b0b0b] border border-[#2b2b2b] px-2.5 py-2 text-[11px] text-gray-200 outline-none focus:border-terminal-accent font-mono"
                />
              </div>

              <div className="rounded border border-[#1d1d1d] bg-black/60 px-3 py-2.5">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">Model</div>
                <input
                  list="free-claude-model-hints"
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, model: e.target.value }))}
                  placeholder={getDefaultModel(aiSettings.provider)}
                  className="w-full bg-[#0b0b0b] border border-[#2b2b2b] px-2.5 py-2 text-[11px] text-gray-200 outline-none focus:border-terminal-accent font-mono"
                />
                <datalist id="free-claude-model-hints">
                  {[getDefaultModel(aiSettings.provider), ...modelHints].map((hint) => (
                    <option key={hint} value={hint} />
                  ))}
                </datalist>
              </div>

              <p className="text-[10px] text-gray-600 leading-relaxed">
                Settings are stored locally. Production builds use runtime defaults and your saved provider/model/key.
              </p>
            </div>
          </section>
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
