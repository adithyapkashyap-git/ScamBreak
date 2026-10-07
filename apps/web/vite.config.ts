import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base =
  process.env.VITE_BASE_PATH ??
  (process.env.GITHUB_ACTIONS || process.env.NODE_ENV === 'production' ? '/ScamBreak/' : '/');

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_ORIGIN ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
