import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendAlgorithmEvent,
  createRunMetadata,
  readAlgorithmEventsSince,
  readAlgorithmRunState,
  readRunMetadata,
  resolveRunDirectory,
} from '../../server/algorithm-runs/run-store.js';

describe('Algorithm run store', () => {
  let previousRoot: string | undefined;
  let tempRoot: string;

  beforeEach(async () => {
    previousRoot = process.env.ALGORITHM_RUN_STORE_ROOT;
    tempRoot = await mkdtemp(join(tmpdir(), 'algorithm-runs-'));
    process.env.ALGORITHM_RUN_STORE_ROOT = tempRoot;
    await createRunMetadata({
      runId: 'alg_1',
      ownerUserId: '42',
      projectPath: '/tmp/p',
      provider: 'claude',
      status: 'starting',
    });
  });

  afterEach(async () => {
    if (previousRoot === undefined) {
      delete process.env.ALGORITHM_RUN_STORE_ROOT;
    } else {
      process.env.ALGORITHM_RUN_STORE_ROOT = previousRoot;
    }
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('stores metadata and returns events after a cursor', async () => {
    await appendAlgorithmEvent('alg_1', { type: 'algorithm.run.started', payload: {} });
    await appendAlgorithmEvent('alg_1', { type: 'algorithm.phase.changed', payload: { phase: 'plan' } });

    const events = await readAlgorithmEventsSince('alg_1', 1);
    expect(events.map((event) => event.sequence)).toEqual([2]);
  });

  it('preserves ownerUserId for route authorization', async () => {
    const metadata = await readRunMetadata('alg_1');
    expect(metadata.ownerUserId).toBe('42');
  });

  it('updates sessionId when a session-bound event is projected', async () => {
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.session.bound',
      payload: { sessionId: 'sess_123' },
    });
    const metadata = await readRunMetadata('alg_1');
    expect(metadata.sessionId).toBe('sess_123');
  });

  it('projects live phases, deliverables, and final output into public state', async () => {
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.phases.updated',
      payload: {
        phases: [
          { id: 'research', label: 'P1', title: 'Research', status: 'complete' },
          { id: 'implementation', label: 'P2', title: 'Implementation', status: 'active' },
        ],
        currentReviewLine: 'Reviewing implementation files',
      },
    });
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.deliverables.updated',
      payload: {
        deliverables: [
          { id: 'plan', title: 'Implementation plan', subtitle: 'Markdown', tone: 'document' },
        ],
      },
    });
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.output.updated',
      payload: {
        output: { title: 'Run complete', body: 'Implemented live app wiring.' },
      },
    });

    const state = await readAlgorithmRunState('alg_1');

    expect(state.currentPhaseIndex).toBe(1);
    expect(state.phase).toBe('implementation');
    expect(state.currentReviewLine).toBe('Reviewing implementation files');
    expect(state.phases.map((phase: any) => phase.status)).toEqual(['complete', 'active']);
    expect(state.deliverables[0]).toMatchObject({
      title: 'Implementation plan',
      subtitle: 'Markdown',
      tone: 'document',
    });
    expect(state.finalOutput).toMatchObject({
      title: 'Run complete',
      body: 'Implemented live app wiring.',
    });
  });

  it('does not expose filesystem paths in public state', async () => {
    const state = await readAlgorithmRunState('alg_1');
    expect(JSON.stringify(state)).not.toContain('events.jsonl');
    expect(JSON.stringify(state)).not.toContain('/tmp/p');
  });

  it('rejects unsafe run ids and verifies path containment under the store root', () => {
    expect(() => resolveRunDirectory('../escape')).toThrow();
    expect(() => resolveRunDirectory('.hidden')).toThrow();
    expect(resolveRunDirectory('valid-run_123').startsWith(tempRoot)).toBe(true);
  });

  it('rejects duplicate explicit sequences', async () => {
    await appendAlgorithmEvent('alg_1', { sequence: 1, type: 'algorithm.run.started', payload: {} });
    await expect(appendAlgorithmEvent('alg_1', {
      sequence: 1,
      type: 'algorithm.phase.changed',
      payload: { phase: 'plan' },
    })).rejects.toMatchObject({ code: 'state_corrupt' });
  });

  it('fails reads when the JSONL event log is malformed', async () => {
    await writeFile(join(resolveRunDirectory('alg_1'), 'events.jsonl'), '{not-json}\n', 'utf8');
    await expect(readAlgorithmRunState('alg_1')).rejects.toMatchObject({ code: 'state_corrupt' });
  });
});
