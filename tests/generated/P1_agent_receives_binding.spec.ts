/**
 * @gwt.id    gwt-nolme-binding-contract-server
 * @rr.reads  rr.nolme.forwarded_props
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi } from 'vitest';
import { lastValueFrom, toArray, type Observable } from 'rxjs';

const { fetchHistoryMock, readStateMock } = vi.hoisted(() => ({
  fetchHistoryMock: vi.fn(),
  readStateMock: vi.fn(),
}));

vi.mock('../../server/providers/registry.js', () => ({
  getProvider: (_name: string) => ({ fetchHistory: fetchHistoryMock }),
  getAllProviders: () => ['claude', 'cursor', 'codex', 'gemini'],
}));

vi.mock('../../server/agents/nolme-state-store.js', () => ({
  DEFAULT_NOLME_STATE: {
    schemaVersion: 1,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    resources: [],
    profile: null,
    quickActions: [],
    taskNotifications: [],
  },
  readState: readStateMock,
  writeState: vi.fn(),
}));

vi.mock('../../server/claude-sdk.js', () => ({ queryClaudeSDK: vi.fn() }));
vi.mock('../../server/cursor-cli.js', () => ({ spawnCursor: vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex: vi.fn() }));
vi.mock('../../server/gemini-cli.js', () => ({ spawnGemini: vi.fn() }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

const binding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: 'p',
  projectPath: '/x',
  model: 'opus-4-7',
};

async function collect(obs: Observable<any>) {
  return await lastValueFrom(obs.pipe(toArray()));
}

describe('P1 · CcuSessionAgent.connect receives forwardedProps.binding', () => {
  it('emits RUN_STARTED then completes successfully when binding is present', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [] });
    readStateMock.mockResolvedValue({
      schemaVersion: 1,
      phases: [],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: null,
      quickActions: [],
      taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu' });
    const events = await collect(
      agent.connect({
        threadId: 's-1',
        runId: 'r-1',
        messages: [],
        tools: [],
        context: [],
        forwardedProps: { binding },
      } as any),
    );

    const types = events.map((e) => e.type);
    expect(types).toContain('RUN_STARTED');
    expect(types).toContain('RUN_FINISHED');
    expect(types).not.toContain('RUN_ERROR');
  });

  it('emits RUN_ERROR when forwardedProps.binding is missing (contract lock)', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu' });
    const events = await collect(
      agent.connect({
        threadId: 's-1',
        runId: 'r-1',
        messages: [],
        tools: [],
        context: [],
        forwardedProps: {},
      } as any),
    );

    const errorEvent = events.find((e) => e.type === 'RUN_ERROR');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toMatch(/missing forwardedProps\.binding/);
  });
});
