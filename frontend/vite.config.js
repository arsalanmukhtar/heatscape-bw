import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Local dev reads VITE_* from the root .env; Docker passes them as build args or env.
  envDir: '..',
  server: {
    port: 5180,
    strictPort: true,
    // Set in docker-compose.dev.yml: bind-mounted files need polling for HMR.
    watch: process.env.WATCH_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
});
