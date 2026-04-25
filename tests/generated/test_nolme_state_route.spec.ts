import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import express from 'express';

const readStateMock = vi.hoisted(() => vi.fn());
vi.mock('../../server/agents/nolme-state-store.js', () => ({
  DEFAULT_NOLME_STATE: { schemaVersion: 1 },
  readState: readStateMock,
  writeState: vi.fn(async () => {}),
}));

import nolmeStateRouter from '../../server/routes/nolme-state.js';

let server: http.Server;
let port: number;

async function start() {
  const app = express();
  app.use('/api/nolme', nolmeStateRouter);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

describe('GET /api/nolme/state/:sessionId (Phase 3 · B16 server half)', () => {
  beforeEach(async () => {
    readStateMock.mockReset();
    await start();
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns the sidecar state JSON for a valid request', async () => {
    readStateMock.mockResolvedValue({ schemaVersion: 1, phases: [{ id: 'p1' }] });
    const res = await fetch(
      `http://127.0.0.1:${port}/api/nolme/state/s1?provider=claude&projectName=-x&projectPath=/x`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ schemaVersion: 1, phases: [{ id: 'p1' }] });
    expect(readStateMock).toHaveBeenCalledWith({
      sessionId: 's1',
      projectName: '-x',
      projectPath: '/x',
      provider: 'claude',
    });
  });

  it('400 when provider query param is missing', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/nolme/state/s1?projectName=-x`);
    expect(res.status).toBe(400);
    expect(readStateMock).not.toHaveBeenCalled();
  });

  it('500 when readState throws', async () => {
    readStateMock.mockRejectedValue(new Error('disk'));
    const res = await fetch(
      `http://127.0.0.1:${port}/api/nolme/state/s1?provider=claude&projectName=-x`,
    );
    expect(res.status).toBe(500);
  });
});
