import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';

// Stub the CopilotKit runtime at module-load so no real CopilotRuntime
// instantiation happens (it tries to bind GraphQL schema). The route module
// under test only needs to call the stubbed factories and wire up middleware.
const { copilotHandler, runtimeConstructorOptions } = vi.hoisted(() => ({
  copilotHandler: vi.fn(async (_req: any, res: any) => {
    res.status(200).json({ ok: true, hit: 'copilot' });
  }),
  runtimeConstructorOptions: [] as any[],
}));

// Mock @copilotkit/runtime/v2: createCopilotExpressHandler returns a real
// Express Router whose sole middleware forwards every request to our spy
// handler. This lets the B10 assertions verify (a) authenticateToken runs
// first, and (b) the CopilotKit mount receives the request for every sub-path.
import express from 'express';

vi.mock('@copilotkit/runtime/v2', () => {
  class StubInMemoryAgentRunner {
    run() { /* stubbed */ }
    connect() { /* stubbed */ }
  }
  class StubCopilotRuntime {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(opts: any) {
      runtimeConstructorOptions.push(opts);
    }
  }
  return {
    CopilotRuntime: StubCopilotRuntime,
    InMemoryAgentRunner: StubInMemoryAgentRunner,
    createCopilotExpressHandler: () => {
      const router = express.Router();
      router.use((req, res) => copilotHandler(req, res));
      return router;
    },
  };
});

// Stub CcuSessionAgent to avoid importing the real provider-runtime functions.
vi.mock('../../server/agents/ccu-session-agent.js', () => {
  class StubCcuSessionAgent {
    agentId = 'ccu';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_opts?: any) { /* stubbed */ }
  }
  return { CcuSessionAgent: StubCcuSessionAgent };
});

import { mountCopilotKit } from '../../server/routes/copilotkit.js';

function fakeAuth(req: any, res: any, next: () => void) {
  const hdr = req.headers['authorization'];
  if (!hdr || !hdr.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'no token' });
  }
  const token = hdr.slice(7);
  if (token !== 'good-token') {
    return res.status(403).json({ error: 'bad token' });
  }
  req.user = { id: 42 };
  next();
}

let server: http.Server;
let port: number;

async function startWithAuth(): Promise<void> {
  const app = express();
  app.use('/api/copilotkit', fakeAuth);
  mountCopilotKit(app);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

describe('mountCopilotKit — authenticated route (Phase 1 · B10)', () => {
  beforeEach(async () => {
    copilotHandler.mockClear();
    await startWithAuth();
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns 401 when request lacks Authorization header', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/copilotkit/agent/ccu/run`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(copilotHandler).not.toHaveBeenCalled();
  });

  it('returns 403 when Authorization header has an invalid token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/copilotkit/agent/ccu/run`, {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(403);
    expect(copilotHandler).not.toHaveBeenCalled();
  });

  it('reaches the CopilotKit handler when token is valid', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/copilotkit/agent/ccu/run`, {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
    });
    expect(res.status).toBe(200);
    expect(copilotHandler).toHaveBeenCalledTimes(1);
  });

  it('threads authenticated req.user.id into the CopilotKit request headers', async () => {
    copilotHandler.mockClear();
    const res = await fetch(`http://127.0.0.1:${port}/api/copilotkit/agent/ccu/run`, {
      method: 'POST',
      headers: { Authorization: 'Bearer good-token' },
    });

    expect(res.status).toBe(200);
    expect(copilotHandler).toHaveBeenCalledTimes(1);
    expect(copilotHandler.mock.calls[0][0].headers['x-cc-user-id']).toBe('42');
  });

  it('installs a custom runner so connect replay can be filtered defensively', async () => {
    expect(runtimeConstructorOptions.length).toBeGreaterThan(0);
    const latestOptions = runtimeConstructorOptions.at(-1);
    expect(latestOptions?.runner).toBeDefined();
    expect(typeof latestOptions?.runner?.run).toBe('function');
    expect(typeof latestOptions?.runner?.connect).toBe('function');
  });

  it('dispatches every sub-path under /api/copilotkit (connect, stop, …)', async () => {
    for (const suffix of ['agent/ccu/connect', 'agent/ccu/stop/t1']) {
      copilotHandler.mockClear();
      const res = await fetch(`http://127.0.0.1:${port}/api/copilotkit/${suffix}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
      });
      expect(res.status).toBe(200);
      expect(copilotHandler).toHaveBeenCalledTimes(1);
    }
  });
});
