import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';

const fetchHistoryMock = vi.hoisted(() => vi.fn());

vi.mock('../../server/providers/registry.js', () => ({
  getProvider: () => ({ fetchHistory: fetchHistoryMock }),
  getAllProviders: () => ['claude'],
}));

import messagesRouter from '../../server/routes/messages.js';

function fakeAuth(req: any, res: any, next: () => void) {
  if (req.headers.authorization !== 'Bearer good') {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
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

describe('/api/sessions messages route contract smoke test', () => {
  it('remains protected by mount-level authenticateToken', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [] });
    const app = express();
    app.use('/api/sessions', fakeAuth, messagesRouter);
    await withServer(app, async (port) => {
      const missing = await fetch(`http://127.0.0.1:${port}/api/sessions/s1/messages`);
      expect(missing.status).toBe(401);
      expect(fetchHistoryMock).not.toHaveBeenCalled();
      const ok = await fetch(`http://127.0.0.1:${port}/api/sessions/s1/messages`, {
        headers: { Authorization: 'Bearer good' },
      });
      expect(ok.status).toBe(200);
      expect(fetchHistoryMock).toHaveBeenCalled();
    });
  });
});

