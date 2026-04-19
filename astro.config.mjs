import { defineConfig } from 'astro/config';
import path from 'path';

import vue from '@astrojs/vue';

export default defineConfig({
  site: 'https://moonsun.ai',
  compressHTML: true,
  trailingSlash: 'always',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
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
  },

  integrations: [vue()]
});
