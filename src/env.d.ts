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
  goldPriceInterval?: ReturnType<typeof setInterval>;
  openAuthModal?: (mode?: 'login' | 'signup') => void;
}
