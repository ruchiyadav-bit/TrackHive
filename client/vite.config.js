import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
      '/go': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
      '/click': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
      '/postback': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
    },
  },
});
