// gwt-0007: fork.server.forwards-resume-session-at
// When options.resumeSessionAt is a non-empty UUID string, mapCliOptionsToSDK
// must forward it byte-for-byte. Empty/missing → not set.

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('gwt-0007 fork.server.forwards-resume-session-at', () => {
  // Verifier: ResumeAtForwarded + StringIdentity + NoClobber
  it('forwards a non-empty UUID string byte-for-byte (with resume co-present)', () => {
    const uuid = '01234567-89ab-cdef-0123-456789abcdef';
    const parent = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const sdk = mapCliOptionsToSDK({
      cwd: '/r',
      toolsSettings: { allowedTools: ['Bash'], disallowedTools: [], skipPermissions: false },
      resume: parent,
      resumeSessionAt: uuid,
    });

    // ResumeAtForwarded
    expect(sdk.resumeSessionAt).toBe(uuid);

    // StringIdentity — byte-identical, no transform
    expect(Object.is(sdk.resumeSessionAt, uuid)).toBe(true);

    // NoClobber
    expect(sdk.cwd).toBe('/r');
    expect(sdk.allowedTools).toEqual(['Bash']);
    expect(sdk.resume).toBe(parent);
  });

  // Verifier: ResumeAtAbsent (empty)
  it('omits resumeSessionAt when empty string', () => {
    const sdk = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
      resumeSessionAt: '',
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'resumeSessionAt')).toBe(false);
  });

  // Verifier: ResumeAtAbsent (missing)
  it('omits resumeSessionAt when missing', () => {
    const sdk = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'resumeSessionAt')).toBe(false);
  });
});
