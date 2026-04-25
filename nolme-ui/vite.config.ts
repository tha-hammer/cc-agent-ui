import { defineConfig, type Plugin } from 'vite';
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

/**
 * CopilotKit v2's stylesheet ships with Tailwind v4 directives — bare
 * `@layer name;` declarations and `@layer base { ... }` blocks outside a
 * `@tailwind base` root. Tailwind v3's PostCSS plugin then errors with either
 * "no matching @tailwind base" or "layerRule.nodes is not iterable". This
 * pre-transform plugin strips the Tailwind v4 layer wrappers from the vendor
 * file before PostCSS sees it; the inner CSS rules still apply.
 */
function stripCopilotKitV2TailwindV4Directives(): Plugin {
  return {
    name: 'strip-copilotkit-v2-tailwind-v4-directives',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@copilotkit/react-core/dist/v2/index.css')) return null;

      let out = '';
      let i = 0;
      while (i < code.length) {
        const layerMatch = code.slice(i).match(/^@layer\s+([A-Za-z][A-Za-z0-9_-]*)\s*([;{])/);
        if (!layerMatch) {
          out += code[i];
          i += 1;
          continue;
        }
        const terminator = layerMatch[2];
        const matchLen = layerMatch[0].length;
        if (terminator === ';') {
          // Bare `@layer name;` — drop entirely.
          i += matchLen;
          continue;
        }
        // Block form `@layer name { ... }` — drop the wrapper, keep inner CSS.
        let depth = 1;
        let j = i + matchLen;
        while (j < code.length && depth > 0) {
          const ch = code[j];
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) break;
          }
          j += 1;
        }
        if (depth === 0) {
          out += code.slice(i + matchLen, j);
          i = j + 1;
        } else {
          // Unbalanced — fall through, append literally.
          out += code.slice(i, j);
          i = j;
        }
      }
      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  base: '/nolme/',
  plugins: [stripCopilotKitV2TailwindV4Directives(), react()],
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
