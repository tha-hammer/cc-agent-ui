// G-7: continueConversation option maps to SDK continue: true
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('mapCliOptionsToSDK — continueConversation', () => {
  it('forwards continueConversation as continue: true when no sessionId', () => {
    const sdk = mapCliOptionsToSDK({ continueConversation: true });
    expect(sdk.continue).toBe(true);
    expect(sdk.resume).toBeUndefined();
  });

  it('sessionId takes precedence over continueConversation', () => {
    const sdk = mapCliOptionsToSDK({ continueConversation: true, sessionId: 'resume-me' });
    expect(sdk.resume).toBe('resume-me');
    expect(sdk.continue).toBeUndefined();
  });

  it('absent continueConversation leaves continue undefined (regression)', () => {
    const sdk = mapCliOptionsToSDK({});
    expect(sdk.continue).toBeUndefined();
    expect(sdk.resume).toBeUndefined();
  });

  it('explicit sessionId without continueConversation still maps to resume (regression)', () => {
    const sdk = mapCliOptionsToSDK({ sessionId: 'just-resume' });
    expect(sdk.resume).toBe('just-resume');
    expect(sdk.continue).toBeUndefined();
  });
});
