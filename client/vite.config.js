import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxying /api to the backend keeps the frontend origin-relative: no
    // hard-coded localhost:4000 in the client code, and therefore no CORS
    // preflight in development and no config change when deploying behind
    // a single origin.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
