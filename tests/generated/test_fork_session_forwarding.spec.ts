// G-2: SDK-canonical fork forwarding (tail-fork via --fork-session)
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('mapCliOptionsToSDK — forkSession forwarding (G-2)', () => {
  it('forwards forkSession when paired with sessionId (resume)', () => {
    const sdk = mapCliOptionsToSDK({ sessionId: 'parent', forkSession: true });
    expect(sdk.resume).toBe('parent');
    expect(sdk.forkSession).toBe(true);
  });

  it('does NOT forward forkSession without a resume target', () => {
    const sdk = mapCliOptionsToSDK({ forkSession: true });
    expect(sdk.forkSession).toBeUndefined();
    expect(sdk.resume).toBeUndefined();
  });

  it('does NOT forward resumeSessionAt (blocklisted)', () => {
    const sdk = mapCliOptionsToSDK({ sessionId: 'parent', forkSession: true, resumeSessionAt: 'u1' });
    expect(sdk.resumeSessionAt).toBeUndefined();
  });

  it('does NOT forward caller-supplied sessionId as --session-id (blocklisted)', () => {
    const sdk = mapCliOptionsToSDK({ sessionId: 'parent', forkSession: true });
    // sessionId maps to sdkOptions.resume, NOT sdkOptions.sessionId
    expect(sdk.sessionId).toBeUndefined();
  });

  it('regression: no fork forwarding when forkSession absent', () => {
    const sdk = mapCliOptionsToSDK({ sessionId: 'parent' });
    expect(sdk.forkSession).toBeUndefined();
    expect(sdk.resume).toBe('parent');
  });
});
