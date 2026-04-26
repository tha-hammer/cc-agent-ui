import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';

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

describe('/api/agent route contract smoke test', () => {
  it('remains mounted as its own API-key style route, not behind app JWT auth', async () => {
    const agentHandler = vi.fn((_req, res) => res.status(401).json({ error: 'API key required' }));
    const app = express();
    app.use('/api/agent', agentHandler);
    await withServer(app, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/agent`);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'API key required' });
      expect(agentHandler).toHaveBeenCalled();
    });
  });
});

