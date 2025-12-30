import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: '.', // Корень проекта
  server: {
    port: 5173,
    proxy: {
      // Все запросы, начинающиеся с /api, отправляем на бэкенд (порт 3001)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'public', // Сборка попадет в public, чтобы Express мог её раздать (при желании)
  },
});
