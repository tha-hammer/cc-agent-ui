import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import algorithmRunsRouter from '../../server/routes/algorithm-runs.js';

function validateApiKey(req: any, res: any, next: () => void) {
  if (!process.env.API_KEY) return next();
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

function fakeAuth(req: any, res: any, next: () => void) {
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).json({ error: 'Access denied. No token provided.' });
  if (hdr !== 'Bearer good') return res.status(403).json({ error: 'Invalid token' });
  req.user = { id: 42 };
  next();
}

async function withServer(app: express.Express, fn: (port: number) => Promise<void>) {
  let server: http.Server;
  let port: number;
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
  try {
    await fn(port!);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Algorithm run route mount auth', () => {
  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('rejects unauthenticated requests before algorithm route code runs', async () => {
    const app = express();
    app.use('/api', validateApiKey);
    app.use('/api/algorithm-runs', fakeAuth, algorithmRunsRouter);
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Access denied. No token provided.' });
    });
  });

  it('keeps invalid-token behavior as authenticateToken plain 403', async () => {
    const app = express();
    app.use('/api', validateApiKey);
    app.use('/api/algorithm-runs', fakeAuth, algorithmRunsRouter);
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`, {
        headers: { Authorization: 'Bearer bad' },
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Invalid token' });
    });
  });

  it('inherits the optional global /api API-key gate when API_KEY is configured', async () => {
    process.env.API_KEY = 'test-api-key';
    const app = express();
    app.use('/api', validateApiKey);
    app.use('/api/algorithm-runs', fakeAuth, algorithmRunsRouter);
    await withServer(app, async (port) => {
      const missing = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`);
      expect(missing.status).toBe(401);
      expect(await missing.json()).toEqual({ error: 'Invalid API key' });
      const noJwt = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`, {
        headers: { 'x-api-key': 'test-api-key' },
      });
      expect(noJwt.status).toBe(401);
      expect(await noJwt.json()).toEqual({ error: 'Access denied. No token provided.' });
    });
  });

  it('mounts under /api/algorithm-runs without changing adjacent routes', async () => {
    const app = express();
    const agentSpy = vi.fn((_req, res) => res.json({ ok: true, route: 'agent' }));
    const sessionsSpy = vi.fn((_req, res) => res.json({ ok: true, route: 'sessions' }));
    app.use('/api/algorithm-runs', fakeAuth, algorithmRunsRouter);
    app.use('/api/agent', agentSpy);
    app.use('/api/sessions', fakeAuth, sessionsSpy);
    await withServer(app, async (port) => {
      expect((await fetch(`http://127.0.0.1:${port}/api/agent`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/sessions/s1/messages`, {
        headers: { Authorization: 'Bearer good' },
      })).status).toBe(200);
      expect(agentSpy).toHaveBeenCalled();
      expect(sessionsSpy).toHaveBeenCalled();
    });
  });
});

