import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Local dev reads VITE_* from the root .env; Docker passes them as build args.
  envDir: '..',
  server: { port: 5180, strictPort: true },
});
