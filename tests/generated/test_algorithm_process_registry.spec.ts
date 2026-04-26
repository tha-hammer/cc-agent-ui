import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAlgorithmProcessRegistryForTests,
  getRegisteredProcess,
  registerAlgorithmProcess,
  terminateAlgorithmProcess,
  unregisterAlgorithmProcess,
} from '../../server/algorithm-runs/process-registry.js';

function fakeChildProcess(kill = vi.fn()) {
  const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
  child.kill = kill;
  return child;
}

describe('Algorithm process registry', () => {
  afterEach(() => {
    clearAlgorithmProcessRegistryForTests();
  });

  it('registers a start-run child and removes it on exit', () => {
    const child = fakeChildProcess();
    registerAlgorithmProcess({ runId: 'alg_1', child, ownerUserId: '42' });
    expect(getRegisteredProcess('alg_1')).toBeTruthy();
    child.emit('exit', 0, null);
    expect(getRegisteredProcess('alg_1')).toBeNull();
  });

  it('terminates a registered child for stop cleanup', async () => {
    const kill = vi.fn();
    const child = fakeChildProcess(kill);
    registerAlgorithmProcess({ runId: 'alg_1', child, ownerUserId: '42' });
    const promise = terminateAlgorithmProcess('alg_1', { signal: 'SIGTERM', timeoutMs: 100 });
    child.emit('exit', 0, null);
    await promise;
    expect(kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('keeps unregister idempotent for already-exited children', () => {
    unregisterAlgorithmProcess('alg_1');
    unregisterAlgorithmProcess('alg_1');
    expect(getRegisteredProcess('alg_1')).toBeNull();
  });
});

