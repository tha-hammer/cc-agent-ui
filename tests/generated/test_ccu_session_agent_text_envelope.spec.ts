import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lastValueFrom, toArray } from 'rxjs';

// Mock the Claude runtime BEFORE importing the agent so the mock is applied at module-load time.
vi.mock('../../server/claude-sdk.js', () => ({
  queryClaudeSDK: vi.fn(async (_cmd: string, _opts: unknown, writer: { send: (f: unknown) => void }) => {
    writer.send({ kind: 'stream_delta', role: 'assistant', content: 'Hello' });
    writer.send({ kind: 'stream_end' });
  }),
}));
vi.mock('../../server/cursor-cli.js',    () => ({ spawnCursor:    vi.fn() }));
vi.mock('../../server/openai-codex.js',  () => ({ queryCodex:     vi.fn() }));
vi.mock('../../server/gemini-cli.js',    () => ({ spawnGemini:    vi.fn() }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

const claudeBinding = {
  provider: 'claude' as const,
  sessionId: 's1',
  projectName: '-home-maceo-Dev-temp-testing',
  projectPath: '/home/maceo/Dev/temp_testing',
  model: 'claude-sonnet-4-6',
  permissionMode: 'default' as const,
  toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
};

describe('CcuSessionAgent — minimum text envelope (Phase 1 · B2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits RUN_STARTED → TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT → TEXT_MESSAGE_END → RUN_FINISHED in order', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's1',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'hi' }],
          tools: [],
          context: [],
          forwardedProps: { binding: claudeBinding },
        } as any)
        .pipe(toArray()),
    );
    expect(events.map((e) => e.type)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
  });

  it('TEXT_MESSAGE_CONTENT carries the streamed delta', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's1',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'hi' }],
          tools: [],
          context: [],
          forwardedProps: { binding: claudeBinding },
        } as any)
        .pipe(toArray()),
    );
    const content = events.find((e) => e.type === 'TEXT_MESSAGE_CONTENT') as any;
    expect(content?.delta).toBe('Hello');
  });

  it('invokes queryClaudeSDK with the prompt and binding-derived options', async () => {
    const { queryClaudeSDK } = await import('../../server/claude-sdk.js');
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
    await lastValueFrom(
      agent
        .run({
          threadId: 's1',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'hi there' }],
          tools: [],
          context: [],
          forwardedProps: { binding: claudeBinding },
        } as any)
        .pipe(toArray()),
    );
    expect(queryClaudeSDK).toHaveBeenCalledTimes(1);
    const [prompt, opts] = (queryClaudeSDK as any).mock.calls[0];
    expect(prompt).toBe('hi there');
    expect(opts).toMatchObject({
      projectPath: '/home/maceo/Dev/temp_testing',
      cwd: '/home/maceo/Dev/temp_testing',
      sessionId: 's1',
      model: 'claude-sonnet-4-6',
    });
  });
});
