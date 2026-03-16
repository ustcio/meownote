// ================================================================================
// Internationalization (i18n) Module
// ================================================================================

import { translations as zhCN, type TranslationKey } from './zh-CN';
import { translations as enUS } from './en-US';

export const languages = {
  'zh-CN': '简体中文',
  'en-US': 'English',
} as const;

export type Language = keyof typeof languages;
export const defaultLang: Language = 'zh-CN';

// All translations
const allTranslations = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

// Export types
export type { TranslationKey };
export type Translations = typeof zhCN;

// Get translation by key
export function t(key: TranslationKey, lang: Language = defaultLang): string {
  return allTranslations[lang][key] || key;
}

// Get all translations for a language
export function getTranslations(lang: Language = defaultLang): Translations {
  return allTranslations[lang];
}

// Get language from URL path
export function getLangFromUrl(url: URL): Language {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) {
    return lang as Language;
  }
  return defaultLang;
}

// Get localized path
export function getLocalizedPath(path: string, lang: Language = defaultLang): string {
  // Remove leading slash and any existing language prefix
  const cleanPath = path.replace(/^\//, '').replace(/^(zh-CN|en-US)\//, '');
  
  if (lang === defaultLang) {
    return `/${cleanPath}`;
  }
  return `/${lang}/${cleanPath}`;
}

// Get alternate language path
export function getAlternateLangPath(currentPath: string, currentLang: Language): string {
  const otherLang: Language = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
  return getLocalizedPath(currentPath, otherLang);
}

// Route prefix for static generation
export function routePrefix(lang: Language): string {
  return lang === defaultLang ? '' : `/${lang}`;
}

// Check if a path is for a specific language
export function isLangPath(pathname: string, lang: Language): boolean {
  if (lang === defaultLang) {
    // Default language: path should NOT start with /en-US
    return !pathname.startsWith('/en-US');
  }
  return pathname.startsWith(`/${lang}`);
}

// Get browser language preference
export function getBrowserLang(): Language {
  if (typeof navigator === 'undefined') return defaultLang;
  
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh-CN';
  if (browserLang.startsWith('en')) return 'en-US';
  
  return defaultLang;
}