/**
 * Mount the Nolme Vite bundle as a static sub-app under /nolme.
 *
 * Production: `npm --prefix nolme-ui run build` produces `cc-agent-ui/nolme-ui/dist/`.
 * This module wires that directory into the existing Express app at `/nolme/*`
 * with SPA fallback to index.html so deep links (e.g. `/nolme/session/abc`) work.
 *
 * Does NOT intercept `/api/*` or `/ws` — mounting order matters; call this
 * AFTER the API routes in server/index.js.
 *
 * @module routes/nolme-static
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default resolved path to `cc-agent-ui/nolme-ui/dist/`.
 * Overridable via the second arg of {@link mountNolmeStatic} (test harness).
 */
export const DEFAULT_NOLME_DIST = path.resolve(__dirname, '..', '..', 'nolme-ui', 'dist');

/**
 * @param {import('express').Application} app
 * @param {string} [distDir] - Absolute path to the built bundle directory.
 */
export function mountNolmeStatic(app, distDir = DEFAULT_NOLME_DIST) {
  // Serve hashed assets + index.html.
  app.use('/nolme', express.static(distDir));

  // SPA fallback — any deep link under /nolme that isn't a file returns index.html.
  app.get('/nolme/*', (_req, res, next) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return next();
    }
    res.sendFile(indexPath);
  });
}
