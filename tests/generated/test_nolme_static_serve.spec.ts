import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { mountNolmeStatic } from '../../server/routes/nolme-static.js';

let server: http.Server;
let port: number;
let tmpDir: string;

function startServer(app: express.Application): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      port = addr.port;
      resolve();
    });
  });
}

async function closeServer(): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('mountNolmeStatic (Phase 1 · B11)', () => {
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nolme-dist-'));
    fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html><body>nolme</body></html>');
    fs.writeFileSync(path.join(tmpDir, 'assets', 'app-abc123.js'), 'console.log("nolme");');

    const app = express();
    mountNolmeStatic(app, tmpDir);
    await startServer(app);
  });

  afterEach(async () => {
    await closeServer();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves /nolme/ index.html', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nolme/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('nolme');
  });

  it('serves /nolme/assets/* with correct content', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nolme/assets/app-abc123.js`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('console.log("nolme");');
  });

  it('falls back to index.html for deep SPA routes (e.g. /nolme/session/abc)', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nolme/session/abc`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('nolme');
  });

  it('does not intercept /api/ paths', async () => {
    // Re-mount with a stub /api route to confirm static-serve doesn't swallow it.
    await closeServer();
    const app = express();
    app.get('/api/ping', (_req, res) => res.json({ ok: true }));
    mountNolmeStatic(app, tmpDir);
    await startServer(app);

    const res = await fetch(`http://127.0.0.1:${port}/api/ping`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
