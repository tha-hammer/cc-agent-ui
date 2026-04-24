import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lastValueFrom, toArray } from 'rxjs';

const sentFrames: Array<{ handler: (w: any) => void }> = [];

vi.mock('../../server/claude-sdk.js', () => ({
  queryClaudeSDK: vi.fn(async (_cmd: string, _opts: unknown, writer: any) => {
    for (const entry of sentFrames) entry.handler(writer);
  }),
}));
vi.mock('../../server/cursor-cli.js',   () => ({ spawnCursor:    vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex:     vi.fn() }));
vi.mock('../../server/gemini-cli.js',   () => ({ spawnGemini:    vi.fn() }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

const claudeBinding = {
  provider: 'claude' as const,
  sessionId: 'primary-s1',
  projectName: '-abs-foo',
  projectPath: '/abs/foo',
  model: 'claude-sonnet-4-6',
  permissionMode: 'default' as const,
  toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
};

function run(agent: CcuSessionAgent) {
  return lastValueFrom(
    agent
      .run({
        threadId: 'primary-s1',
        runId: 'r1',
        messages: [{ id: 'u1', role: 'user', content: 'hi' }],
        tools: [],
        context: [],
        forwardedProps: { binding: claudeBinding },
      } as any)
      .pipe(toArray()),
  );
}

describe('CcuSessionAgent — subagent / meta filter (Phase 1 · B3)', () => {
  beforeEach(() => {
    sentFrames.length = 0;
    vi.clearAllMocks();
  });

  it('drops frames whose sessionId does not match the run primary sessionId', async () => {
    sentFrames.push({
      handler: (w) => {
        // Subagent-spawn leak: same kind, wrong sessionId
        w.send({ kind: 'stream_delta', content: 'ignore me', sessionId: 'subagent-xyz' });
        // Primary-session legit frame
        w.send({ kind: 'stream_delta', content: 'hello primary', sessionId: 'primary-s1' });
        w.send({ kind: 'stream_end', sessionId: 'primary-s1' });
      },
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    const events = await run(agent);

    const deltas = events.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT') as any[];
    expect(deltas).toHaveLength(1);
    expect(deltas[0].delta).toBe('hello primary');
  });

  it('accepts frames with no sessionId field (defaults to primary)', async () => {
    sentFrames.push({
      handler: (w) => {
        w.send({ kind: 'stream_delta', content: 'unscoped ok' });
        w.send({ kind: 'stream_end' });
      },
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    const events = await run(agent);

    const deltas = events.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT') as any[];
    expect(deltas).toHaveLength(1);
    expect(deltas[0].delta).toBe('unscoped ok');
  });

  it('only emits STATE_SNAPSHOT for the first session_created; subsequent subagent spawns dropped', async () => {
    // Bind with no sessionId (new-session run); first session_created becomes primary.
    const newSessionBinding = { ...claudeBinding, sessionId: '' };

    sentFrames.push({
      handler: (w) => {
        w.send({ kind: 'session_created', newSessionId: 'brand-new-s' });
        // Subagent spawns its own session — should NOT re-emit STATE_SNAPSHOT.
        w.send({ kind: 'session_created', newSessionId: 'subagent-child' });
      },
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: '',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'hi' }],
          tools: [],
          context: [],
          forwardedProps: { binding: newSessionBinding },
        } as any)
        .pipe(toArray()),
    );

    const snapshots = events.filter((e) => e.type === 'STATE_SNAPSHOT') as any[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].snapshot).toMatchObject({ sessionId: 'brand-new-s' });
  });
});
