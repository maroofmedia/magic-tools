// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [
    preact({ compat: true }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['pdf-lib', 'browser-image-compression', 'jszip', 'heic2any'],
      exclude: ['pdfjs-dist'],
    },
    ssr: {
      noExternal: ['pdf-lib', 'browser-image-compression', 'jszip'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('pdf-lib')) return 'pdflib';
            if (id.includes('browser-image-compression')) return 'imgcompression';
            if (id.includes('heic2any')) return 'heic2any';
          },
        },
      },
    },
  },
});
