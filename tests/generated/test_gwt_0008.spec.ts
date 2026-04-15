// gwt-0008: fork.server.forwards-session-id-only-when-forking
// sdkOptions.sessionId is forwarded ONLY when options.forkSession === true
// (per SDK contract at sdk.d.ts:834). Legacy sessionId-only path still maps to resume.

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

const PARENT = '11111111-1111-4111-8111-111111111111';
const FORKED = '22222222-2222-4222-8222-222222222222';

describe('gwt-0008 fork.server.forwards-session-id-only-when-forking', () => {
  // Verifier: SessionIdGatedByFork + ForkFieldPropagated
  it('sets sdkOptions.sessionId when forkSession=true (SessionIdGatedByFork, ForkFieldPropagated)', () => {
    const out = mapCliOptionsToSDK({
      sessionId: FORKED,
      resume: PARENT,
      forkSession: true,
      resumeSessionAt: 'asst-uuid-xyz',
      cwd: '/tmp/proj',
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });

    // ForkFieldPropagated — verbatim forwarding
    expect(out.sessionId).toBe(FORKED);
    expect(out.forkSession).toBe(true);
    expect(out.resume).toBe(PARENT);
    expect(out.resumeSessionAt).toBe('asst-uuid-xyz');
  });

  // Verifier: NoLeakWithoutFork (forkSession missing)
  it('does NOT forward sessionId when forkSession is absent (NoLeakWithoutFork)', () => {
    const out = mapCliOptionsToSDK({
      sessionId: FORKED,
      cwd: '/tmp/proj',
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(out.sessionId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(out, 'sessionId')).toBe(false);
  });

  // Verifier: NoLeakWithoutFork (forkSession=false)
  it('does NOT forward sessionId when forkSession=false', () => {
    const out = mapCliOptionsToSDK({
      sessionId: FORKED,
      forkSession: false,
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(out.sessionId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(out, 'sessionId')).toBe(false);
  });

  // Verifier: LegacyResumePreserved
  it('legacy sessionId-only path still maps to sdkOptions.resume (LegacyResumePreserved)', () => {
    const out = mapCliOptionsToSDK({
      sessionId: PARENT,
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(out.resume).toBe(PARENT);
    expect(out.sessionId).toBeUndefined();
  });

  // Additional: explicit options.resume alongside sessionId (no forkSession) — resume wins, sessionId absent
  it('legacy path with both sessionId and resume: explicit resume wins, sessionId absent without fork', () => {
    const out = mapCliOptionsToSDK({
      sessionId: FORKED,
      resume: PARENT,
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(out.resume).toBe(PARENT);
    expect(out.sessionId).toBeUndefined();
  });
});
