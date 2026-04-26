import { describe, expect, it } from 'vitest';
import { runAlgorithmCommand, startAlgorithmRun } from '../../server/algorithm-runs/command-client.js';
import { mapCoreAlgorithmStateToRunState } from '../../server/algorithm-runs/runner-adapter.js';

describe('Algorithm runner adapter executable', () => {
  it('emits accepted and result frames through the command client', async () => {
    const result = await startAlgorithmRun({
      executable: process.execPath,
      args: ['./server/algorithm-runs/runner-adapter.js'],
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: { prompt: 'test', provider: 'claude' },
      timeoutMs: 1000,
      onFrame: () => {},
    });
    expect(result.ok).toBe(true);
    expect(result.accepted.runId).toBe('alg_1');
  });

  it('maps core-like state to public AlgorithmRunState without private fields', () => {
    const state = mapCoreAlgorithmStateToRunState({
      sessionId: 'sess_1',
      currentPhase: 'plan',
      loopStatus: 'paused',
      prdPath: '/private/prd.md',
      projectPath: '/private/project',
      rawStderr: 'secret',
      capabilities: ['private-capability'],
    });
    expect(state.sessionId).toBe('sess_1');
    expect(state.phase).toBe('plan');
    expect(state.status).toBe('paused');
    expect(JSON.stringify(state)).not.toContain('/private');
    expect(JSON.stringify(state)).not.toContain('secret');
    expect(JSON.stringify(state)).not.toContain('private-capability');
  });

  it('uses the fixture runner for deterministic protocol tests', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: ['./tests/fixtures/algorithm-runner-fixture.mjs'],
      command: 'pause',
      runId: 'alg_1',
      requestId: 'req_2',
      ownerUserId: '42',
      payload: {},
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(true);
  });
});

