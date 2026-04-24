import { describe, it, expect, vi } from 'vitest';
import { lastValueFrom, toArray } from 'rxjs';

/**
 * B30 · Happy-path integration
 *
 * Simulates the full run-phase the Nolme UI exercises end-to-end:
 *   1. user submits a prompt
 *   2. agent emits narrative text
 *   3. agent calls setPhaseState (workflow bar materializes)
 *   4. agent streams three output cards (tool_use → tool_result)
 *   5. agent asks for approval (permission_request)
 *   6. agent completes
 *
 * We don't render the CopilotKit provider here — that would require a live
 * AG-UI runtime connection. Instead we drive CcuSessionAgent.run() directly
 * and assert the AG-UI event envelope reaches the Observable in the right
 * order, which is what the NolmeDashboard + CopilotKit layer consumes.
 *
 * This validates the full server-side path: frames → translator → observer.
 */

vi.mock('../../server/claude-sdk.js', () => ({
  queryClaudeSDK: vi.fn(async (_cmd: string, _opts: unknown, writer: { send: (f: unknown) => void }) => {
    // Narrative
    writer.send({ kind: 'stream_delta', content: 'Pulling the phase plan... ', sessionId: 's-e2e' });
    writer.send({ kind: 'stream_delta', content: 'Here are three venue candidates.', sessionId: 's-e2e' });
    writer.send({ kind: 'stream_end', sessionId: 's-e2e' });

    // Agent calls setPhaseState (tool_use + tool_result)
    writer.send({
      kind: 'tool_use',
      toolId: 't-set-phase',
      toolName: 'setPhaseState',
      toolInput: {
        phases: [
          { id: 'p1', label: 'Phase 1', title: 'Audience & venue', status: 'active' },
          { id: 'p2', label: 'Phase 2', title: 'Promote & sell', status: 'idle' },
        ],
        currentPhaseIndex: 0,
      },
      sessionId: 's-e2e',
    });
    writer.send({ kind: 'tool_result', toolId: 't-set-phase', content: 'ok', sessionId: 's-e2e' });

    // Three venue cards
    for (let i = 0; i < 3; i += 1) {
      writer.send({
        kind: 'tool_use',
        toolId: `t-venue-${i}`,
        toolName: 'showVenueCard',
        toolInput: {
          title: `Common Space ${i}`,
          subtitle: '3108B Filmore St, San Francisco, CA',
          description: `Budget: $${2400 - i * 50}`,
          rating: 4.9 - i * 0.1,
        },
        sessionId: 's-e2e',
      });
      writer.send({ kind: 'tool_result', toolId: `t-venue-${i}`, content: 'rendered', sessionId: 's-e2e' });
    }

    // Approval request (HITL)
    writer.send({
      kind: 'permission_request',
      requestId: 'approve-p1',
      toolName: 'approvePhase',
      input: { phaseId: 'p1', options: ['Confirm Phase 1 👍', 'Make changes'] },
      sessionId: 's-e2e',
    });
    // Operator clicks Confirm — permission_cancelled resolves the HITL
    writer.send({ kind: 'permission_cancelled', requestId: 'approve-p1', sessionId: 's-e2e' });

    writer.send({ kind: 'complete', sessionId: 's-e2e' });
  }),
}));
vi.mock('../../server/cursor-cli.js',   () => ({ spawnCursor:    vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex:     vi.fn() }));
vi.mock('../../server/gemini-cli.js',   () => ({ spawnGemini:    vi.fn() }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

const binding = {
  provider: 'claude' as const,
  sessionId: 's-e2e',
  projectName: '-home-x',
  projectPath: '/home/x',
  model: 'claude-sonnet-4-6',
  permissionMode: 'default' as const,
  toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
};

describe('Nolme happy-path integration (Phase 6 · B30)', () => {
  it('emits the full RUN_STARTED → … → RUN_FINISHED envelope in order', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's-e2e',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'Start phase 1' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    expect(events[0].type).toBe('RUN_STARTED');
    expect(events[events.length - 1].type).toBe('RUN_FINISHED');
  });

  it('produces the narrative text envelope (TEXT_MESSAGE_START + CONTENT×2 + END)', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's-e2e',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'Start phase 1' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    const text = events.filter((e) => e.type.startsWith('TEXT_MESSAGE_'));
    const types = text.map((e) => e.type);
    expect(types[0]).toBe('TEXT_MESSAGE_START');
    expect(types[types.length - 1]).toBe('TEXT_MESSAGE_END');
    const contents = text.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT').map((e) => (e as any).delta);
    expect(contents.join('')).toBe('Pulling the phase plan... Here are three venue candidates.');
  });

  it('produces one TOOL_CALL pair for setPhaseState and 3 pairs for showVenueCard', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's-e2e',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'Start phase 1' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    const starts = events.filter((e) => e.type === 'TOOL_CALL_START');
    const ends = events.filter((e) => e.type === 'TOOL_CALL_END');
    const toolNames = starts.map((e) => (e as any).toolCallName);

    expect(toolNames).toEqual([
      'setPhaseState',
      'showVenueCard',
      'showVenueCard',
      'showVenueCard',
      'requestPermission',
    ]);
    expect(ends).toHaveLength(5); // 4 tool results + permission_cancelled close
  });

  it('surfaces the requestPermission synthetic tool call with phaseId + options in args', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's-e2e',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'Start phase 1' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    const permStart = events.find((e) => e.type === 'TOOL_CALL_START' && (e as any).toolCallName === 'requestPermission') as any;
    expect(permStart).toBeDefined();
    const permArgs = events.find((e) => e.type === 'TOOL_CALL_ARGS' && (e as any).toolCallId === permStart.toolCallId) as any;
    expect(permArgs).toBeDefined();
    const parsed = JSON.parse(permArgs.delta);
    expect(parsed.toolName).toBe('approvePhase');
    expect(parsed.input.phaseId).toBe('p1');
    expect(parsed.input.options).toEqual(['Confirm Phase 1 👍', 'Make changes']);
  });

  it('session filter: frames with a wrong sessionId during the run are dropped', async () => {
    // This test re-uses the mock above but stuffs a noise frame. We extend the
    // mock via vi.mocked to layer additional behavior.
    const { queryClaudeSDK } = await import('../../server/claude-sdk.js');
    vi.mocked(queryClaudeSDK).mockImplementationOnce(async (_c, _o, w) => {
      w.send({ kind: 'stream_delta', content: 'leak from a subagent', sessionId: 'subagent-xyz' });
      w.send({ kind: 'stream_delta', content: 'real primary', sessionId: 's-e2e' });
      w.send({ kind: 'stream_end', sessionId: 's-e2e' });
      w.send({ kind: 'complete', sessionId: 's-e2e' });
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's-e2e',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'run' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    const deltas = events.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT').map((e) => (e as any).delta);
    expect(deltas).toEqual(['real primary']);
  });
});
