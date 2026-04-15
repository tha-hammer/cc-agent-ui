// gwt-0013: fork.spike.sdk-replay-events-arrive
// Spike integration test: exercises queryClaudeSDK end-to-end with a mocked
// @anthropic-ai/claude-agent-sdk. Verifies:
//   - StreamTerminates
//   - NewSessionIdObserved
//   - AdapterNeverFails
//   - AdapterOutputWellFormed
//   - ReplayIdentityPreserved

import { describe, it, expect, vi } from 'vitest';

const PARENT = '11111111-1111-4111-8111-111111111111';
const NEW    = '22222222-2222-4222-8222-222222222222';
const ASST   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Stub the SDK before importing claude-sdk.js
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  async function* fakeQuery() {
    // Replay: user msg (was the original turn-1 user input)
    yield {
      type: 'user',
      isReplay: true,
      uuid: 'r-u1',
      message: { role: 'user', content: 'hi' },
      parent_tool_use_id: null,
      session_id: NEW,
    };
    // Replay: assistant msg
    yield {
      type: 'assistant',
      uuid: 'r-a1',
      parent_tool_use_id: null,
      message: {
        id: 'm-a1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'hey' }],
        model: 'claude-sonnet-4.5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      session_id: NEW,
    };
    // Fresh assistant turn (post-replay)
    yield {
      type: 'assistant',
      uuid: 'a2',
      parent_tool_use_id: null,
      message: {
        id: 'm-a2',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'fresh' }],
        model: 'claude-sonnet-4.5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      session_id: NEW,
    };
    yield {
      type: 'result',
      subtype: 'success',
      session_id: NEW,
      modelUsage: {},
      duration_ms: 1,
      duration_api_ms: 1,
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0,
    };
  }
  return { query: vi.fn(() => fakeQuery()) };
});

import { queryClaudeSDK } from '../../server/claude-sdk.js';
import * as claudeAdapter from '../../server/providers/claude/adapter.js';

describe('gwt-0013 fork.spike.sdk-replay-events-arrive', () => {
  it('consumes the fork stream, normalizes replay events, observes new session_id', async () => {
    const sent: any[] = [];
    const ws = {
      send: vi.fn((m: any) => sent.push(m)),
      setSessionId: vi.fn(),
      userId: null,
    };

    // StreamTerminates — generator consumption completes without thrown error
    await expect(
      queryClaudeSDK(
        '',
        {
          sessionId: NEW,
          resume: PARENT,
          forkSession: true,
          resumeSessionAt: ASST,
          cwd: '/tmp/proj',
          images: undefined,
          toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
        },
        ws as any,
      ),
    ).resolves.not.toThrow();

    // StreamTerminates — got a complete event
    expect(sent.some((m) => m.kind === 'complete')).toBe(true);

    // NewSessionIdObserved — at least one event carries the new session id,
    // and no event carries the parent id as sessionId.
    expect(sent.some((m) => m.sessionId === NEW)).toBe(true);
    expect(sent.every((m) => m.sessionId !== PARENT)).toBe(true);

    // AdapterOutputWellFormed — every emitted normalized message has the
    // required invariant fields. (AdapterNeverFails is implied: if the
    // adapter threw on any replay event, queryClaudeSDK would have
    // rejected, which it did not.)
    for (const m of sent) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(m.provider).toBe('claude');
      expect(typeof m.kind).toBe('string');
      // sessionId may be null for pre-capture frames, otherwise must be NEW.
      if (m.sessionId !== null) expect(m.sessionId).toBe(NEW);
    }

    // AdapterNeverFails — direct re-exercise on the canonical replay event.
    const replayEvent = {
      type: 'user',
      isReplay: true,
      uuid: 'r-u1',
      message: { role: 'user', content: 'hi' },
      parent_tool_use_id: null,
      session_id: NEW,
    };
    let out: any;
    expect(() => {
      out = claudeAdapter.normalizeMessage(replayEvent, NEW);
    }).not.toThrow();

    // AdapterOutputWellFormed (direct) + ReplayIdentityPreserved
    expect(Array.isArray(out)).toBe(true);
    for (const nm of out) {
      expect(typeof nm.id).toBe('string');
      expect(nm.id.length).toBeGreaterThan(0);
      expect(nm.sessionId).toBe(NEW);
      expect(nm.provider).toBe('claude');
      expect(typeof nm.kind).toBe('string');
      // ReplayIdentityPreserved — normalized id preserves sdk uuid
      // (adapter uses `baseId = raw.uuid || …`, may suffix per content block).
      expect(nm.id.startsWith('r-u1')).toBe(true);
    }
  });
});
