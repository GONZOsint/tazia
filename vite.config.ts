import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/tazia/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'apple-touch-icon.png',
        'brand/tazia-mark.svg',
      ],
      injectRegister: 'script',
      manifest: {
        name: 'TAZIA',
        short_name: 'TAZIA',
        description: 'Temporary Anonymous Zone In Action — live browser chat, no accounts.',
        // Static install/splash chrome (manifest cannot track runtime theme).
        // Live theme-color meta is synced by theme-boot.js + ThemeContext.
        theme_color: '#0b0d09',
        background_color: '#0b0d09',
        display: 'standalone',
        lang: 'es',
        start_url: '/tazia/',
        scope: '/tazia/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        navigateFallback: '/tazia/index.html',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
