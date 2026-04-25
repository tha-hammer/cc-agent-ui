/**
 * @gwt.id    gwt-nolme-model-forward-lock
 * @rr.reads  rr.nolme.model_dispatch
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { startThreadSpy, resumeThreadSpy } = vi.hoisted(() => ({
  startThreadSpy: vi.fn(),
  resumeThreadSpy: vi.fn(),
}));

function makeThread() {
  return {
    id: 'thread-xyz',
    runStreamed: vi.fn(async () => ({
      // eslint-disable-next-line require-yield
      events: (async function* () {
        return;
      })(),
    })),
  };
}

vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    startThread(opts: any) {
      startThreadSpy(opts);
      return makeThread();
    }
    resumeThread(id: string, opts: any) {
      resumeThreadSpy(id, opts);
      return makeThread();
    }
  },
}));

vi.mock('../../server/services/notification-orchestrator.js', () => ({
  notifyRunFailed: vi.fn(),
  notifyRunStopped: vi.fn(),
}));

vi.mock('../../server/providers/codex/adapter.js', () => ({
  codexAdapter: {
    normalizeMessage: vi.fn(() => []),
  },
}));

describe('I2 · Codex thread options include model — regression lock', () => {
  beforeEach(() => {
    startThreadSpy.mockReset();
    resumeThreadSpy.mockReset();
  });

  it('forwards options.model into startThread({ model }) for a new thread', async () => {
    const { queryCodex } = await import('../../server/openai-codex.js');
    await queryCodex('hi', { model: 'gpt-5-codex', projectPath: '/x' }, { send: vi.fn() });

    expect(startThreadSpy).toHaveBeenCalled();
    const threadOpts = startThreadSpy.mock.calls[0][0];
    expect(threadOpts.model).toBe('gpt-5-codex');
  });

  it('forwards options.model into resumeThread(id, { model }) when sessionId is set', async () => {
    const { queryCodex } = await import('../../server/openai-codex.js');
    await queryCodex('hi', { model: 'gpt-5-codex', projectPath: '/x', sessionId: 'existing-s' }, { send: vi.fn() });

    expect(resumeThreadSpy).toHaveBeenCalled();
    const [id, threadOpts] = resumeThreadSpy.mock.calls[0];
    expect(id).toBe('existing-s');
    expect(threadOpts.model).toBe('gpt-5-codex');
  });
});
