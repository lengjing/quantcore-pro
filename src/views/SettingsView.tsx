import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketMode, ColorScheme, AIProvider, AISettings, TradingMode } from '../types';
import type { AdapterCapability } from '../services/stock/IStockDataAdapter';
import { ButtonGroup } from '../components/ui/ButtonGroup';
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

export const SettingsView = ({ marketMode, setMarketMode, tradingMode, setTradingMode, colorScheme, setColorScheme, capMap, setCapMap, aiSettings, setAiSettings, vitePort, freeClaudePort }: SettingsViewProps) => {
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

  const providerButtons = FREE_CLAUDE_PROVIDER_OPTIONS.map((provider) => ({
    value: provider.id,
    label: provider.label,
    activeColor: provider.local ? 'text-green-400' : 'text-terminal-accent',
  }));
  const currentProvider = FREE_CLAUDE_PROVIDER_OPTIONS.find((provider) => provider.id === aiSettings.provider) ?? FREE_CLAUDE_PROVIDER_OPTIONS[0];
  const modelHints = getProviderModelHints(aiSettings.provider).slice(0, 6);

  return (
    <div className="flex h-full overflow-auto bg-[radial-gradient(circle_at_top,_rgba(255,153,0,0.08),_transparent_35%),linear-gradient(180deg,_#090909_0%,_#111_100%)]">
      <div className="w-full p-4 md:p-6">
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-[#2a2a2a] pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-terminal-accent">{t('CONFIGURATION')}</div>
            <h2 className="text-2xl font-semibold text-gray-100">Control center</h2>
          </div>
          <div className="text-[10px] text-gray-500 font-mono">v{__APP_VERSION__}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="border border-[#2f2f2f] bg-[#101010]/95 p-5 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">System</div>
                <h3 className="text-lg font-semibold text-gray-100">Market and execution</h3>
              </div>
              <button className="rounded-sm border border-[#333] bg-[#1a1a1a] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:border-terminal-accent" onClick={() => setShowResetConfirm(true)}>
                {t('RESET_FACTORY')}
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="border border-[#222] bg-[#0b0b0b] p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">{t('INTERFACE_LANGUAGE')}</div>
                  <ButtonGroup
                    options={[
                      { value: 'EN', label: 'EN' },
                      { value: 'CN', label: '中文' },
                    ]}
                    value={currentLang}
                    onChange={handleLanguageChange}
                    size="sm"
                  />
                </label>

                <label className="border border-[#222] bg-[#0b0b0b] p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Trading mode</div>
                  <ButtonGroup
                    options={[
                      { value: 'PAPER', label: 'PAPER', activeColor: 'text-gray-300' },
                      { value: 'LIVE', label: 'LIVE', activeColor: 'text-red-400' },
                    ]}
                    value={tradingMode}
                    onChange={setTradingMode}
                    size="sm"
                  />
                </label>
              </div>

              <label className="border border-[#222] bg-[#0b0b0b] p-3 block">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">{t('DEFAULT_MARKET')}</div>
                <ButtonGroup
                  options={[
                    { value: 'CRYPTO', label: 'CRYPTO', activeColor: 'text-blue-400' },
                    { value: 'CN_STOCK', label: 'A-SHARE', activeColor: 'text-red-400' },
                  ]}
                  value={marketMode}
                  onChange={setMarketMode}
                  size="sm"
                />
              </label>

              <label className="border border-[#222] bg-[#0b0b0b] p-3 block">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">{t('COLOR_SCHEME')}</div>
                <p className="text-[10px] text-gray-600 mb-2">{t('COLOR_SCHEME_HINT')}</p>
                <ButtonGroup
                  options={[
                    { value: 'greenUp', label: t('COLOR_GREEN_RED'), activeColor: 'text-green-400' },
                    { value: 'redUp', label: t('COLOR_RED_GREEN'), activeColor: 'text-red-400' },
                  ]}
                  value={colorScheme}
                  onChange={setColorScheme}
                  size="sm"
                />
              </label>

              <div className="border border-[#222] bg-[#0b0b0b] p-3">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">{t('ASHARE_DATA_SOURCE')}</div>
                <div className="space-y-2">
                  {(Object.keys(CAPABILITY_LABELS) as AdapterCapability[]).map((cap) => (
                    <div key={cap} className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-mono text-gray-500">{CAPABILITY_LABELS[cap]}</span>
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
            </div>
          </section>

          <section className="border border-[#2f2f2f] bg-[#101010]/95 p-5 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">AI</div>
                <h3 className="text-lg font-semibold text-gray-100">free-claude-code runtime</h3>
              </div>
              <div className="rounded-sm border border-[#2a2a2a] px-3 py-1 text-[10px] font-mono text-gray-400">
                {getProviderLabel(aiSettings.provider)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Provider</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {providerButtons.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleProviderChange(option.value)}
                      className={`flex flex-col items-start border px-3 py-2 text-left transition-colors ${aiSettings.provider === option.value ? 'border-terminal-accent bg-[#171717] text-white' : 'border-[#262626] bg-[#0c0c0c] text-gray-400 hover:border-[#444] hover:text-gray-200'}`}
                    >
                      <span className={`text-[11px] font-bold ${option.activeColor ?? ''}`}>{option.label}</span>
                      <span className="mt-1 text-[9px] text-gray-500">{FREE_CLAUDE_PROVIDER_OPTIONS.find((provider) => provider.id === option.value)?.credentialEnv ?? 'Local runtime'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="block">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">API key</div>
                  <input
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, apiKey: e.target.value }))}
                    placeholder={currentProvider.credentialEnv ?? 'Optional local runtime key'}
                    className="w-full bg-[#0c0c0c] border border-[#333] px-3 py-2 text-[11px] text-gray-200 outline-none focus:border-terminal-accent"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Model</div>
                  <input
                    list="free-claude-model-hints"
                    type="text"
                    value={aiSettings.model}
                    onChange={(e) => setAiSettings((prev) => normalizeAiSettings({ ...prev, model: e.target.value }))}
                    placeholder={getDefaultModel(aiSettings.provider)}
                    className="w-full bg-[#0c0c0c] border border-[#333] px-3 py-2 text-[11px] text-gray-200 outline-none focus:border-terminal-accent font-mono"
                  />
                  <datalist id="free-claude-model-hints">
                    {[getDefaultModel(aiSettings.provider), ...modelHints].map((hint) => (
                      <option key={hint} value={hint} />
                    ))}
                  </datalist>
                </label>
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-gray-500">Model suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {[getDefaultModel(aiSettings.provider), ...modelHints].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setAiSettings((prev) => normalizeAiSettings({ ...prev, model: hint }))}
                      className="rounded-sm border border-[#2a2a2a] bg-[#0c0c0c] px-2 py-1 text-[10px] text-gray-400 hover:border-terminal-accent hover:text-terminal-accent"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-600 leading-relaxed">
                Settings are persisted locally in the browser profile. Packaged builds ignore .env and use the bundled runtime plus the values saved here.
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
