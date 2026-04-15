// gwt-0014: fork.spike.error-path-on-bad-uuid
// Spike integration test: SDK throws inside the async generator on a bad
// resumeSessionAt. Verifies:
//   - ValidPhase (SDK throw during iteration, not pre-call)
//   - ErrorEmittedOnThrow
//   - NoHalfState
//   - ErrorContentIsMessage
//   - NoPreflightNeeded

import { describe, it, expect, vi } from 'vitest';

const PARENT = '11111111-1111-4111-8111-111111111111';
const NEW    = '22222222-2222-4222-8222-222222222222';
const BAD_AT = 'claude_not_a_uuid_at_all';
const THROWN = 'Invalid resumeSessionAt: message UUID not found';

vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  async function* throwingQuery() {
    // ValidPhase: throw happens during iteration (after generator is pulled),
    // not synchronously at query() call time.
    throw new Error(THROWN);
    // eslint-disable-next-line no-unreachable
    yield undefined as any;
  }
  return { query: vi.fn(() => throwingQuery()) };
});

import { queryClaudeSDK, mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('gwt-0014 fork.spike.error-path-on-bad-uuid', () => {
  it('emits {kind:error, content, provider:claude} when SDK throws on bad resumeSessionAt', async () => {
    const sent: any[] = [];
    const ws = {
      send: vi.fn((m: any) => sent.push(m)),
      setSessionId: vi.fn(),
      userId: null,
    };

    // ValidPhase + rethrow: queryClaudeSDK re-throws after emitting the WS error.
    await expect(
      queryClaudeSDK(
        '',
        {
          sessionId: NEW,
          resume: PARENT,
          forkSession: true,
          resumeSessionAt: BAD_AT,
          cwd: '/tmp/proj',
          images: undefined,
          toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
        },
        ws as any,
      ),
    ).rejects.toThrow(THROWN);

    // ErrorEmittedOnThrow — exactly one error frame.
    const errors = sent.filter((m) => m.kind === 'error');
    expect(errors).toHaveLength(1);

    // ErrorContentIsMessage — content is the thrown message, provider tagged.
    expect(errors[0]).toMatchObject({
      kind: 'error',
      content: THROWN,
      provider: 'claude',
    });

    // NoHalfState — no session_created / complete / other frames before error.
    expect(sent.some((m) => m.kind === 'complete')).toBe(false);
    expect(sent.some((m) => m.kind === 'session_created')).toBe(false);
    // Only frame sent on this failed run is the single error frame.
    expect(sent).toHaveLength(1);
  });

  it('NoPreflightNeeded: mapCliOptionsToSDK does not validate resumeSessionAt', () => {
    // Negative assertion — mapCliOptionsToSDK is a pure passthrough for
    // resumeSessionAt; validation lives in the SDK + the catch block.
    expect(() =>
      mapCliOptionsToSDK({
        sessionId: NEW,
        resume: PARENT,
        forkSession: true,
        resumeSessionAt: BAD_AT,
      } as any),
    ).not.toThrow();

    const out = mapCliOptionsToSDK({
      sessionId: NEW,
      resume: PARENT,
      forkSession: true,
      resumeSessionAt: BAD_AT,
    } as any);
    // passthrough confirmed
    expect(out.resumeSessionAt).toBe(BAD_AT);
  });
});
