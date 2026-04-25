/**
 * @gwt.id    gwt-nolme-model-forward-lock
 * @rr.reads  rr.nolme.model_dispatch
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { spawnSpy } = vi.hoisted(() => ({
  spawnSpy: vi.fn(),
}));

function makeMockProcess() {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const stdout = {
    on: vi.fn((_evt: string, _cb: any) => stdout),
    removeListener: vi.fn(),
  };
  const stderr = {
    on: vi.fn((_evt: string, _cb: any) => stderr),
    removeListener: vi.fn(),
  };
  const proc: any = {
    stdin: { end: vi.fn(), write: vi.fn() },
    stdout,
    stderr,
    on: vi.fn((evt: string, cb: (...args: any[]) => void) => {
      handlers[evt] = cb;
      if (evt === 'close') {
        // Fire close(0) on next tick so the returned Promise resolves.
        setImmediate(() => cb(0));
      }
      return proc;
    }),
    kill: vi.fn(),
    pid: 12345,
  };
  return proc;
}

vi.mock('child_process', () => ({
  default: { spawn: spawnSpy },
  spawn: spawnSpy,
}));

vi.mock('node:child_process', () => ({
  default: { spawn: spawnSpy },
  spawn: spawnSpy,
}));

vi.mock('cross-spawn', () => ({
  default: spawnSpy,
  spawn: spawnSpy,
}));

vi.mock('../../server/sessionManager.js', () => ({
  default: {
    getSession: vi.fn(() => null),
    addMessage: vi.fn(),
  },
}));

vi.mock('../../server/services/notification-orchestrator.js', () => ({
  notifyRunFailed: vi.fn(),
  notifyRunStopped: vi.fn(),
}));

vi.mock('../../server/gemini-response-handler.js', () => ({
  default: class {
    processChunk() {}
    finalize() {}
    forceFlush() {}
    destroy() {}
  },
}));

describe('I1 · Gemini --model flag — regression lock', () => {
  beforeEach(() => {
    spawnSpy.mockReset();
    spawnSpy.mockImplementation(() => makeMockProcess());
  });

  it('appends --model gemini-2.5-pro when options.model is set', async () => {
    const { spawnGemini } = await import('../../server/gemini-cli.js');
    await spawnGemini('hello', { projectPath: '/tmp/nonexistent-path-for-i1', model: 'gemini-2.5-pro' }, { send: vi.fn() });

    expect(spawnSpy).toHaveBeenCalled();
    const args = spawnSpy.mock.calls[0][1] as string[];
    expect(args).toContain('--model');
    const idx = args.indexOf('--model');
    expect(args[idx + 1]).toBe('gemini-2.5-pro');
  });

  it('falls back to gemini-2.5-flash when options.model is omitted', async () => {
    const { spawnGemini } = await import('../../server/gemini-cli.js');
    await spawnGemini('hello', { projectPath: '/tmp/nonexistent-path-for-i1' }, { send: vi.fn() });

    const args = spawnSpy.mock.calls.at(-1)?.[1] as string[];
    expect(args).toContain('--model');
    const idx = args.indexOf('--model');
    expect(args[idx + 1]).toBe('gemini-2.5-flash');
  });
});
