import { defineConfig } from 'astro/config';
import path from 'path';

export default defineConfig({
  site: 'https://ustc.dev',
  compressHTML: true,
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en-US'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  build: {
    inlineStylesheets: 'auto',
    assets: '_assets'
  },
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild'
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@styles': path.resolve('./src/styles'),
        '@utils': path.resolve('./src/utils'),
        '@i18n': path.resolve('./src/i18n'),
        '@content': path.resolve('./src/content'),
      }
    }
  }
});
