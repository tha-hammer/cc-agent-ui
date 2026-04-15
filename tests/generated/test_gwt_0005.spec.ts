// gwt-0005: fork.server.forwards-resume
// When options.resume is a non-empty string, mapCliOptionsToSDK must additively
// copy it to sdkOptions.resume without altering any existing field.

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('gwt-0005 fork.server.forwards-resume', () => {
  // Verifier: ResumeForwarded + NoClobber
  it('additively copies options.resume into sdkOptions.resume (ResumeForwarded, NoClobber)', () => {
    const parentSessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const sdk = mapCliOptionsToSDK({
      cwd: '/repo',
      permissionMode: 'acceptEdits',
      toolsSettings: { allowedTools: ['Read'], disallowedTools: ['Bash'], skipPermissions: false },
      resume: parentSessionId,
    });

    // ResumeForwarded
    expect(sdk.resume).toBe(parentSessionId);

    // NoClobber — pre-existing fields unaffected
    expect(sdk.cwd).toBe('/repo');
    expect(sdk.permissionMode).toBe('acceptEdits');
    expect(sdk.allowedTools).toEqual(['Read']);
    expect(sdk.disallowedTools).toEqual(['Bash']);
    expect(sdk.tools).toEqual({ type: 'preset', preset: 'claude_code' });
    expect(sdk.model).toBeDefined();
  });

  // Verifier: ResumeAbsent
  it('does not set resume when absent (ResumeAbsent)', () => {
    const sdk = mapCliOptionsToSDK({
      cwd: '/r',
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'resume')).toBe(false);
  });

  // Verifier: ResumeAbsent (empty string)
  it('does not set resume when empty string', () => {
    const sdk = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
      resume: '',
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'resume')).toBe(false);
  });
});
