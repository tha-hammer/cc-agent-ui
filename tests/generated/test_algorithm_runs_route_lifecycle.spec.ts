import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import algorithmRunsRouter from '../../server/routes/algorithm-runs.js';
import {
  appendAlgorithmEvent,
  createRunMetadata,
  readAlgorithmRunState,
} from '../../server/algorithm-runs/run-store.js';

let server: http.Server;
let port: number;
let tempRoot: string;
let previousRoot: string | undefined;
let previousCommand: string | undefined;

function authFor(userId: number) {
  return (req: any, _res: any, next: () => void) => {
    req.user = { id: userId };
    next();
  };
}

async function start(userId = 42) {
  const app = express();
  app.use(express.json());
  app.use('/api/algorithm-runs', authFor(userId), algorithmRunsRouter);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

async function seed(status = 'running', ownerUserId = '42') {
  await createRunMetadata({
    runId: 'alg_1',
    ownerUserId,
    projectPath: '/tmp/p',
    provider: 'claude',
    status: 'starting',
  });
  await appendAlgorithmEvent('alg_1', { type: 'algorithm.status.changed', payload: { status } });
}

describe('Algorithm lifecycle routes', () => {
  beforeEach(async () => {
    previousRoot = process.env.ALGORITHM_RUN_STORE_ROOT;
    previousCommand = process.env.ALGORITHM_RUNNER_COMMAND;
    tempRoot = await mkdtemp(join(tmpdir(), 'algorithm-lifecycle-'));
    process.env.ALGORITHM_RUN_STORE_ROOT = tempRoot;
    process.env.ALGORITHM_RUNNER_COMMAND = JSON.stringify([process.execPath, './tests/fixtures/algorithm-runner-fixture.mjs']);
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousRoot === undefined) delete process.env.ALGORITHM_RUN_STORE_ROOT;
    else process.env.ALGORITHM_RUN_STORE_ROOT = previousRoot;
    if (previousCommand === undefined) delete process.env.ALGORITHM_RUNNER_COMMAND;
    else process.env.ALGORITHM_RUNNER_COMMAND = previousCommand;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('forwards pause for a running run', async () => {
    await seed();
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/pause`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.command).toBe('pause');
    expect(body.state.status).toBe('paused');
  });

  it('rejects owner mismatch before command-client call', async () => {
    await seed('running', '7');
    await start(42);
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/pause`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('rejects resume for a completed run without changing state', async () => {
    await seed('completed');
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/resume`, { method: 'POST' });
    expect(res.status).toBe(409);
    expect((await readAlgorithmRunState('alg_1')).status).toBe('completed');
  });
});

