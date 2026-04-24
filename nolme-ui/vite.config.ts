import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Nolme Vite config.
 *
 * base: '/nolme/' is load-bearing — cc-agent-ui's Express server serves this
 * bundle at /nolme/* and cc-agent-ui's service worker (public/sw.js:39-52)
 * caches /assets/* cache-first. Emitting to /nolme/assets/* keeps the two
 * bundles in distinct namespaces so their hashed filenames never collide.
 *
 * Dev-mode proxy forwards /api and /ws to cc-agent-ui's Express server on
 * port 3001 (same host:port that cc-agent-ui's own Vite dev proxy uses).
 */
export default defineConfig({
  base: '/nolme/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
