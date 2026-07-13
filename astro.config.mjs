// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://magictools.app',
  output: 'static',

  integrations: [
    preact({ compat: true }),
    sitemap(),
  ],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('pdf-lib')) return 'pdflib';
            if (id.includes('browser-image-compression')) return 'imgcompression';
            if (id.includes('cropperjs')) return 'cropperjs';
          },
        },
      },
    },
  },

  adapter: cloudflare(),
});