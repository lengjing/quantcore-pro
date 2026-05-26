import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import cn from './cn';

/** Union of every i18n translation key. */
export type ResourceKey = keyof typeof en;

/** Supported UI languages. */
export type LangKey = 'EN' | 'CN';

const savedLang = (() => {
  try {
    const raw = localStorage.getItem('qcp:lang');
    if (raw) return JSON.parse(raw) === 'CN' ? 'cn' : 'en';
  } catch { /* ignore */ }
  return 'en';
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cn: { translation: cn },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
