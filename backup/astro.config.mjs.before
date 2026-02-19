import { defineConfig } from 'astro/config';
import path from 'path';

export default defineConfig({
  site: 'https://ustc.dev',
  compressHTML: true,
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
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
