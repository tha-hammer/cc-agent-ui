import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, toArray, type Observable } from 'rxjs';

const { queryClaudeSDKSpy, readStateMock, writeStateMock } = vi.hoisted(() => ({
  queryClaudeSDKSpy: vi.fn(async (_prompt: string, _opts: any, writer: { send: (frame: any) => void }) => {
    writer.send({
      kind: 'status',
      text: 'token_budget',
      tokenBudget: { used: 90, total: 180 },
      provider: 'claude',
      sessionId: 's-1',
    });
  }),
  readStateMock: vi.fn(async () => ({
    schemaVersion: 1,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    resources: [],
    profile: null,
    quickActions: [],
    taskNotifications: [],
  })),
  writeStateMock: vi.fn(async () => {}),
}));

vi.mock('../../server/claude-sdk.js', () => ({ queryClaudeSDK: queryClaudeSDKSpy }));
vi.mock('../../server/cursor-cli.js', () => ({ spawnCursor: vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex: vi.fn() }));
vi.mock('../../server/gemini-cli.js', () => ({ spawnGemini: vi.fn() }));

vi.mock('../../server/providers/registry.js', () => ({
  getProvider: () => ({ fetchHistory: vi.fn() }),
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
  writeState: writeStateMock,
}));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

async function collect(obs: Observable<any>) {
  return await lastValueFrom(obs.pipe(toArray()));
}

describe('CcuSessionAgent token-budget persistence (cam-by2)', () => {
  it('persists the normalized token budget to the Nolme sidecar during a run', async () => {
    const binding = {
      provider: 'claude',
      sessionId: 's-1',
      projectName: '-home-demo',
      projectPath: '/home/demo',
      model: 'sonnet',
    };

    const agent = new CcuSessionAgent({ agentId: 'ccu' });
    await collect(agent.run({
      threadId: 's-1',
      runId: 'r-1',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      context: [],
      forwardedProps: { binding },
    } as any));

    expect(readStateMock).toHaveBeenCalledWith(binding);
    expect(writeStateMock).toHaveBeenCalledWith(
      binding,
      expect.objectContaining({
        tokenBudget: expect.objectContaining({
          provider: 'claude',
          source: 'persisted',
          supported: true,
          used: 90,
          total: 180,
          remaining: 90,
          usedPercent: 50,
          remainingPercent: 50,
        }),
      }),
    );
  });
});
