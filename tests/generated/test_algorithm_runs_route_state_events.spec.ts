import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import algorithmRunsRouter from '../../server/routes/algorithm-runs.js';
import {
  appendAlgorithmEvent,
  createRunMetadata,
} from '../../server/algorithm-runs/run-store.js';
import { streamAlgorithmEvents } from '../../server/algorithm-runs/sse.js';

let server: http.Server;
let port: number;
let tempRoot: string;
let previousRoot: string | undefined;

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

async function seedRun(ownerUserId = '42') {
  await createRunMetadata({
    runId: 'alg_1',
    ownerUserId,
    projectPath: '/tmp/p',
    provider: 'claude',
    status: 'starting',
  });
  await appendAlgorithmEvent('alg_1', { type: 'algorithm.run.started', payload: {} });
  await appendAlgorithmEvent('alg_1', { type: 'algorithm.phase.changed', payload: { phase: 'plan' } });
  await appendAlgorithmEvent('alg_1', { type: 'algorithm.log', payload: { message: 'hi' } });
}

describe('Algorithm run state/events routes', () => {
  beforeEach(async () => {
    previousRoot = process.env.ALGORITHM_RUN_STORE_ROOT;
    tempRoot = await mkdtemp(join(tmpdir(), 'algorithm-events-'));
    process.env.ALGORITHM_RUN_STORE_ROOT = tempRoot;
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousRoot === undefined) delete process.env.ALGORITHM_RUN_STORE_ROOT;
    else process.env.ALGORITHM_RUN_STORE_ROOT = previousRoot;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('returns state without private event path', async () => {
    await seedRun();
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/state`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body.state)).not.toContain('events.jsonl');
    expect(JSON.stringify(body.state)).not.toContain('/tmp/p');
  });

  it('returns cursor-filtered events', async () => {
    await seedRun();
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/events?after=1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.map((event: any) => event.sequence)).toEqual([2, 3]);
    expect(body.cursor.sequence).toBe(3);
  });

  it('rejects owner mismatch before returning state or events', async () => {
    await seedRun('7');
    await start(42);
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/state`);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden');
  });

  it('streams events as SSE when stream=1', async () => {
    await seedRun();
    await appendAlgorithmEvent('alg_1', { type: 'algorithm.run.completed', payload: {} });
    await start();
    const res = await fetch(`http://127.0.0.1:${port}/api/algorithm-runs/alg_1/events?after=1&stream=1`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text.indexOf('event: algorithm.event')).toBeLessThan(text.indexOf('algorithm.run.completed'));
    expect(text).not.toContain('algorithm.heartbeat');
  });

  it('tears down SSE timers when the request closes', async () => {
    vi.useFakeTimers();
    const req = new EventEmitter() as any;
    const writes: string[] = [];
    const res = {
      writableEnded: false,
      statusCode: 0,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => writes.push(chunk)),
      end: vi.fn(() => { res.writableEnded = true; }),
    } as any;
    const cleanup = vi.fn();
    streamAlgorithmEvents({
      req,
      res,
      runId: 'alg_1',
      after: 0,
      readEventsSince: vi.fn(async () => []),
      readState: vi.fn(async () => ({ status: 'running', eventCursor: { sequence: 0 } })),
      pollIntervalMs: 1000,
      heartbeatIntervalMs: 15000,
      maxLifetimeMs: 60000,
      onCleanup: cleanup,
    });
    await vi.runOnlyPendingTimersAsync();
    req.emit('close');
    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

