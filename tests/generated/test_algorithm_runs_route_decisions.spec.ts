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

async function seed(ownerUserId = '42') {
  await createRunMetadata({
    runId: 'alg_1',
    ownerUserId,
    projectPath: '/tmp/p',
    provider: 'claude',
    status: 'running',
  });
}

describe('Algorithm decision routes', () => {
  beforeEach(async () => {
    previousRoot = process.env.ALGORITHM_RUN_STORE_ROOT;
    previousCommand = process.env.ALGORITHM_RUNNER_COMMAND;
    tempRoot = await mkdtemp(join(tmpdir(), 'algorithm-decisions-'));
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

  it('forwards an answer only when questionId matches pending state', async () => {
    await seed();
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.question.requested',
      payload: { id: 'q1', prompt: 'Which test?' },
    });
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/questions/q1/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, answer: 'unit' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questionId).toBe('q1');
    expect(body.state.pendingQuestion).toBeNull();
  });

  it('rejects owner mismatch before checking pending decisions', async () => {
    await seed('7');
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.question.requested',
      payload: { id: 'q1', prompt: 'Which test?' },
    });
    await start(42);
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/questions/q1/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, answer: 'unit' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects stale permission ids before command-client call', async () => {
    await seed();
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.permission.requested',
      payload: { id: 'p1', toolName: 'write', action: 'edit' },
    });
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/permissions/p2/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, allow: true }),
    });
    expect(res.status).toBe(404);
  });

  it('keeps pending state when the runner rejects a matching decision', async () => {
    process.env.ALGORITHM_RUNNER_COMMAND = JSON.stringify([process.execPath, './tests/fixtures/algorithm-runner-fixture.mjs']);
    await seed();
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.question.requested',
      payload: { id: 'q1', prompt: 'Which test?' },
    });
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/questions/q1/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, answer: 'unit', metadata: { fixture: 'nonzero' } }),
    });
    expect(res.status).toBe(502);
    expect((await readAlgorithmRunState('alg_1')).pendingQuestion?.id).toBe('q1');
  });
});
