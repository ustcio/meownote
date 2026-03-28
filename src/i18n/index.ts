// ================================================================================
// Internationalization (i18n) Module - English Only
// ================================================================================

import { translations, type TranslationKey } from './en-US';

export const languages = {
  'en-US': 'English',
  'zh-CN': 'Simplified Chinese',
} as const;

export type Language = keyof typeof languages;
export const defaultLang: Language = 'en-US';

// Export types
export type { TranslationKey };
export type Translations = typeof translations;

function normalizeLang(lang?: string | null): Language {
  return lang === 'zh-CN' ? 'zh-CN' : 'en-US';
}

// Get translation by key (always returns English for the current site build)
export function t(key: TranslationKey, _lang: Language = defaultLang): string {
  return translations[key] ?? key;
}

// Get all translations
export function getTranslations(_lang: Language = defaultLang): Translations {
  return translations;
}

// Get language from URL (static site currently serves English pages only)
export function getLangFromUrl(_url: URL): Language {
  return defaultLang;
}

// Get localized path (passthrough for the current single-locale deployment)
export function getLocalizedPath(path: string, _lang: Language = defaultLang): string {
  return path.startsWith('/') ? path : `/${path}`;
}

// Get alternate language path (no-op until localized routes are enabled)
export function getAlternateLangPath(currentPath: string, _currentLang: Language = defaultLang): string {
  return currentPath;
}

// Route prefix (empty for default language)
export function routePrefix(_lang: Language = defaultLang): string {
  return '';
}

// Check if a path is for a specific language
export function isLangPath(_pathname: string, _lang: Language = defaultLang): boolean {
  return true;
}

// Get browser language preference
export function getBrowserLang(): Language {
  if (typeof navigator === 'undefined') {
    return defaultLang;
  }

  return normalizeLang(navigator.language);
}
