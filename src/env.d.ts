/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_URL: string;
  readonly PUBLIC_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Chart?: new (...args: any[]) => any;
  lottie?: {
    loadAnimation: (...args: any[]) => any;
  };
  goldPriceInterval?: ReturnType<typeof setInterval>;
  openAuthModal?: (mode?: 'login' | 'signup') => void;
  __moonSunCalendarReminders?: {
    checkNow: () => Promise<void>;
  };
  __meownoteAuth?: {
    getToken?: () => string | null;
    getUser?: () => unknown;
    setSession?: (token: string, user: unknown) => void;
    clearSession?: () => void;
  };
  __meownoteBodyScrollLock?: {
    lock?: () => void;
    unlock?: () => void;
  };
  __meownoteToast?: {
    show: (message: string, type?: string, duration?: number) => void;
  };
}
