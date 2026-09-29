import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  // Относительные пути к ассетам: одна сборка работает и в корне (локально, preview), и в
  // подкаталоге GitHub Pages /widgetMAX/. Роутера нет — SPA-fallback не нужен (ресёрч max-chat §3 Р1).
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
