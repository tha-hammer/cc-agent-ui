// G-5: subagent session detection via first-user parentUuid
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect } from 'vitest';
import { isSubagentSession } from '../../server/projects.js';

describe('isSubagentSession', () => {
  it('returns true when first user entry has non-null parentUuid', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'user', parentUuid: 'c5d1925b-1c73-40c1-b09a-c389d0a6294b' },
    ];
    expect(isSubagentSession(entries)).toBe(true);
  });

  it('returns false for a root session (first user parentUuid is null)', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'user', parentUuid: null },
    ];
    expect(isSubagentSession(entries)).toBe(false);
  });

  it('returns false for a root session (first user parentUuid is absent)', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'user' },
    ];
    expect(isSubagentSession(entries)).toBe(false);
  });

  it('returns false when no user entry exists', () => {
    const entries = [{ type: 'queue-operation' }, { type: 'progress' }];
    expect(isSubagentSession(entries)).toBe(false);
  });

  it('returns false for an empty entries array', () => {
    expect(isSubagentSession([])).toBe(false);
  });

  it('inspects the FIRST user entry, not later ones', () => {
    // First user entry is a root user (no parentUuid); later ones have
    // parentUuid but that's normal for a multi-turn conversation.
    const entries = [
      { type: 'user', parentUuid: null },
      { type: 'assistant' },
      { type: 'user', parentUuid: 'some-turn-1-uuid' },
    ];
    expect(isSubagentSession(entries)).toBe(false);
  });
});
