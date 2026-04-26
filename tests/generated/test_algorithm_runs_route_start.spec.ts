import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import algorithmRunsRouter from '../../server/routes/algorithm-runs.js';
import { readAlgorithmEventsSince, readRunMetadata } from '../../server/algorithm-runs/run-store.js';

let server: http.Server;
let port: number;
let tempRoot: string;
let projectPath: string;
let previousRoot: string | undefined;
let previousCommand: string | undefined;

function fakeAuth(req: any, _res: any, next: () => void) {
  req.user = { id: 42 };
  next();
}

async function start() {
  const app = express();
  app.use(express.json());
  app.use('/api/algorithm-runs', fakeAuth, algorithmRunsRouter);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

describe('POST /api/algorithm-runs', () => {
  beforeEach(async () => {
    previousRoot = process.env.ALGORITHM_RUN_STORE_ROOT;
    previousCommand = process.env.ALGORITHM_RUNNER_COMMAND;
    tempRoot = await mkdtemp(join(tmpdir(), 'algorithm-route-'));
    projectPath = await mkdtemp(join(tmpdir(), 'algorithm-project-'));
    process.env.ALGORITHM_RUN_STORE_ROOT = tempRoot;
    process.env.ALGORITHM_RUNNER_COMMAND = JSON.stringify([process.execPath, './tests/fixtures/algorithm-runner-fixture.mjs']);
    await start();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousRoot === undefined) delete process.env.ALGORITHM_RUN_STORE_ROOT;
    else process.env.ALGORITHM_RUN_STORE_ROOT = previousRoot;
    if (previousCommand === undefined) delete process.env.ALGORITHM_RUNNER_COMMAND;
    else process.env.ALGORITHM_RUNNER_COMMAND = previousCommand;
    await rm(tempRoot, { recursive: true, force: true });
    await rm(projectPath, { recursive: true, force: true });
  });

  it('creates owner-bound run metadata and returns 202 after runner accepted', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        projectPath,
        prompt: 'Implement the task',
        provider: 'claude',
        model: 'sonnet',
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.run.ownerUserId).toBe('42');
    expect(body.run.status).toBe('running');
    expect(body.links.state).toContain(body.run.runId);

    const metadata = await readRunMetadata(body.run.runId);
    expect(metadata.ownerUserId).toBe('42');
    const events = await readAlgorithmEventsSince(body.run.runId, 0);
    expect(events[0].type).toBe('algorithm.runner.accepted');
  });

  it('rejects missing project path before creating a run', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, projectPath: '/does-not-exist', prompt: 'x', provider: 'claude' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
  });
});

