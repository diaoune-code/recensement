import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Les appels /api sont relayés vers le backend Service (BACKEND SERVICE, port 4003)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:4003' },
  },
});
