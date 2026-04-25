/**
 * Regression lock: CcuSessionAgent.run must pass the authenticated integer
 * users.id to the AG-UI writer when available, and never fall back to the
 * session UUID (which would trigger SQLite "datatype mismatch").
 */
import { describe, it, expect, vi } from 'vitest';

const { writerSpy, claudeSpy } = vi.hoisted(() => ({
  writerSpy: vi.fn(),
  claudeSpy: vi.fn(async () => {}),
}));

vi.mock('../../server/agents/nolme-ag-ui-writer.js', () => ({
  createNolmeAgUiWriter: (params: { userId?: unknown; onFrame?: unknown }) => {
    writerSpy(params);
    return { send: vi.fn(), close: vi.fn(), userId: params?.userId ?? null };
  },
}));

vi.mock('../../server/claude-sdk.js', () => ({ queryClaudeSDK: claudeSpy }));
vi.mock('../../server/cursor-cli.js', () => ({ spawnCursor: vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex: vi.fn() }));
vi.mock('../../server/gemini-cli.js', () => ({ spawnGemini: vi.fn() }));

vi.mock('../../server/providers/registry.js', () => ({
  getProvider: () => ({ fetchHistory: vi.fn() }),
  getAllProviders: () => ['claude', 'cursor', 'codex', 'gemini'],
}));

vi.mock('../../server/agents/nolme-state-store.js', () => ({
  DEFAULT_NOLME_STATE: {
    schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
    resources: [], profile: null, quickActions: [], taskNotifications: [],
  },
  readState: vi.fn(async () => null),
  writeState: vi.fn(),
}));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';
import { lastValueFrom, toArray } from 'rxjs';

describe('CcuSessionAgent.run · writer.userId wiring', () => {
  it('passes the configured integer userId to the AG-UI writer', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', userId: 42 });
    const obs = agent.run({
      threadId: 's-uuid-string-not-an-integer',
      runId: 'r-1',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      context: [],
      forwardedProps: {
        binding: {
          provider: 'claude',
          sessionId: 's-uuid-string-not-an-integer',
          projectName: 'p',
          projectPath: '/x',
          model: 'opus-4-7',
        },
      },
    } as any);
    await lastValueFrom(obs.pipe(toArray()));

    expect(writerSpy).toHaveBeenCalled();
    const params = writerSpy.mock.calls[0][0];
    expect(params.userId).toBe(42);
    expect(params.userId).not.toBe('s-uuid-string-not-an-integer');
  });
});
