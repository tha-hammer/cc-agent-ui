import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseRunnerCommandEnv,
  runAlgorithmCommand,
  startAlgorithmRun,
} from '../../server/algorithm-runs/command-client.js';
import {
  clearAlgorithmProcessRegistryForTests,
  getRegisteredProcess,
} from '../../server/algorithm-runs/process-registry.js';

const fixture = './tests/fixtures/algorithm-runner-fixture.mjs';

describe('Algorithm command client', () => {
  afterEach(() => {
    clearAlgorithmProcessRegistryForTests();
  });

  it('parses ALGORITHM_RUNNER_COMMAND as a JSON string array', () => {
    expect(parseRunnerCommandEnv('["node","runner.mjs"]')).toEqual({
      ok: true,
      value: { executable: 'node', args: ['runner.mjs'] },
    });
    expect(parseRunnerCommandEnv('node runner.mjs').ok).toBe(false);
    expect(parseRunnerCommandEnv('[]').ok).toBe(false);
  });

  it('sends a JSON request line and parses NDJSON result frames from a fake runner', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: [fixture],
      command: 'pause',
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: {},
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('returns accepted from startAlgorithmRun and forwards later frames', async () => {
    const onFrame = vi.fn();
    const result = await startAlgorithmRun({
      executable: process.execPath,
      args: [fixture],
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: { fixture: 'acceptedTerminalSameChunk' },
      timeoutMs: 1000,
      onFrame,
    });
    expect(result.ok).toBe(true);
    expect(result.accepted.runId).toBe('alg_1');
    await vi.waitFor(() => expect(getRegisteredProcess('alg_1')).toBeNull());
    expect(onFrame).toHaveBeenCalled();
  });

  it('returns runner_timeout when the child does not answer in time', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: [fixture],
      command: 'pause',
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: { fixture: 'timeout' },
      timeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('runner_timeout');
  });

  it('buffers partial stdout chunks and parses a trailing complete JSON line at EOF', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: [fixture],
      command: 'pause',
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: { fixture: 'partial' },
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('maps protocol failures to typed errors', async () => {
    for (const fixtureMode of ['malformed', 'badSchema', 'mismatchRequest', 'nonzero']) {
      const result = await runAlgorithmCommand({
        executable: process.execPath,
        args: [fixture],
        command: 'pause',
        runId: 'alg_1',
        requestId: 'req_1',
        ownerUserId: '42',
        payload: { fixture: fixtureMode },
        timeoutMs: 1000,
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('runner_protocol_error');
    }
  });
});

