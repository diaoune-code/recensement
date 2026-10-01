import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Les appels /api sont relayés vers le backend Mairie (BACKEND MAIRIE, port 4002)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4002' },
  },
});
