import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://meow-note.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
    assets: '_assets'
  },
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild'
    }
  }
});
