/**
 * @gwt.id    gwt-nolme-model-roundtrip
 * @rr.reads  rr.nolme.forwarded_props, rr.nolme.model_id
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi } from 'vitest';
import { lastValueFrom, toArray, type Observable } from 'rxjs';

const { queryClaudeSDKSpy } = vi.hoisted(() => ({ queryClaudeSDKSpy: vi.fn(async (_c: string, _opts: any, _w: any) => {}) }));

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
    schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
    resources: [], profile: null, quickActions: [], taskNotifications: [],
  },
  readState: vi.fn(async () => null),
  writeState: vi.fn(),
}));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

async function collect(obs: Observable<any>) {
  return await lastValueFrom(obs.pipe(toArray()));
}

describe('J2 · binding.model round-trips to provider dispatch', () => {
  it('forwards forwardedProps.binding.model into queryClaudeSDK options.model', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu' });
    await collect(
      agent.run({
        threadId: 's-1',
        runId: 'r-1',
        messages: [{ role: 'user', content: 'hello' }],
        tools: [],
        context: [],
        forwardedProps: {
          binding: {
            provider: 'claude',
            sessionId: 's-1',
            projectName: 'p',
            projectPath: '/x',
            model: 'opus',
          },
        },
      } as any),
    );

    expect(queryClaudeSDKSpy).toHaveBeenCalled();
    const [, opts] = queryClaudeSDKSpy.mock.calls[0];
    expect(opts.model).toBe('opus');
  });
});
