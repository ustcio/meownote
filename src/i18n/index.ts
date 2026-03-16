// ================================================================================
// Internationalization (i18n) Module - English Only
// ================================================================================

import { translations, type TranslationKey } from './en-US';

export const languages = {
  'en': 'English',
} as const;

export type Language = keyof typeof languages;
export const defaultLang: Language = 'en';

// Export types
export type { TranslationKey };
export type Translations = typeof translations;

// Get translation by key (always returns English)
export function t(key: TranslationKey, _lang?: Language): string {
  return translations[key] || key;
}

// Get all translations
export function getTranslations(_lang?: Language): Translations {
  return translations;
}

// Get language from URL (always returns 'en')
export function getLangFromUrl(_url: URL): Language {
  return 'en';
}

// Get localized path (passthrough for English)
export function getLocalizedPath(path: string, _lang?: Language): string {
  return path.startsWith('/') ? path : `/${path}`;
}

// Get alternate language path (no-op for single language)
export function getAlternateLangPath(currentPath: string, _currentLang?: Language): string {
  return currentPath;
}

// Route prefix (empty for default language)
export function routePrefix(_lang?: Language): string {
  return '';
}

// Check if a path is for a specific language
export function isLangPath(_pathname: string, _lang?: Language): boolean {
  return true;
}

// Get browser language preference (always returns 'en')
export function getBrowserLang(): Language {
  return 'en';
}
