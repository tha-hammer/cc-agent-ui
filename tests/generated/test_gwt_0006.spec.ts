// gwt-0006: fork.server.forwards-fork-session
// When options.forkSession === true, mapCliOptionsToSDK must set
// sdkOptions.forkSession = true additively. When absent/false, it must not appear.

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

describe('gwt-0006 fork.server.forwards-fork-session', () => {
  // Verifier: ForkForwardedTrue + NoClobberCwd + NoClobberAllowedTools
  it('forwards forkSession=true additively without clobbering cwd/allowedTools', () => {
    const sdk = mapCliOptionsToSDK({
      cwd: '/r',
      toolsSettings: { allowedTools: ['Read', 'Glob'], disallowedTools: [], skipPermissions: false },
      forkSession: true,
    });

    // ForkForwardedTrue
    expect(sdk.forkSession).toBe(true);

    // NoClobberCwd
    expect(sdk.cwd).toBe('/r');

    // NoClobberAllowedTools
    expect(sdk.allowedTools).toEqual(['Read', 'Glob']);
    expect(sdk.disallowedTools).toEqual([]);
    expect(sdk.tools).toEqual({ type: 'preset', preset: 'claude_code' });
  });

  // Verifier: ForkAbsentByDefault (false)
  it('omits forkSession when input is false', () => {
    const sdk = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
      forkSession: false,
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'forkSession')).toBe(false);
  });

  // Verifier: ForkAbsentByDefault (missing)
  it('omits forkSession when input is missing', () => {
    const sdk = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    expect(Object.prototype.hasOwnProperty.call(sdk, 'forkSession')).toBe(false);
  });
});
