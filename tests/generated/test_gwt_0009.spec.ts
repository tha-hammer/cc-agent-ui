// gwt-0009: fork.server.no-regression-normal-commands
// Verifies that when no fork fields are present in CLI options, mapCliOptionsToSDK
// produces output byte-identical to pre-fork behavior: no resume/forkSession/
// resumeSessionAt/sessionId own-properties leak, and existing shape is preserved.

import { describe, it, expect } from 'vitest';
import { mapCliOptionsToSDK } from '../../server/claude-sdk.js';

const PLAN_TOOLS = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite', 'WebFetch', 'WebSearch'];

describe('gwt-0009 fork.server.no-regression-normal-commands', () => {
  // Verifier: NoForkFieldsWhenAbsent
  //           NormalShapePreserved
  //           DefaultPermissionModeNotWritten
  it('produces legacy-shape output for a minimal options object', () => {
    const out = mapCliOptionsToSDK({
      cwd: '/tmp/proj',
      permissionMode: 'default',
      toolsSettings: { allowedTools: ['Bash'], disallowedTools: [], skipPermissions: false },
    });

    // NormalShapePreserved
    expect(out.cwd).toBe('/tmp/proj');
    expect(out.allowedTools).toEqual(['Bash']);
    expect(out.disallowedTools).toEqual([]);
    expect(out.tools).toEqual({ type: 'preset', preset: 'claude_code' });
    expect(out.model).toBeDefined();
    expect(out.systemPrompt).toMatchObject({ type: 'preset', preset: 'claude_code' });
    expect(out.settingSources).toEqual(['project', 'user', 'local']);

    // NoForkFieldsWhenAbsent
    expect(Object.prototype.hasOwnProperty.call(out, 'resume')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'forkSession')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'resumeSessionAt')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'sessionId')).toBe(false);

    // DefaultPermissionModeNotWritten — 'default' is intentionally NOT written through
    expect(Object.prototype.hasOwnProperty.call(out, 'permissionMode')).toBe(false);
  });

  // Verifier: PlanModeToolsUnion
  it('plan mode unions in the plan toolset and does not leak fork fields', () => {
    const out = mapCliOptionsToSDK({
      permissionMode: 'plan',
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: false },
    });
    for (const t of PLAN_TOOLS) {
      expect(out.allowedTools).toContain(t);
    }
    expect(Object.prototype.hasOwnProperty.call(out, 'forkSession')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'resume')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'resumeSessionAt')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'sessionId')).toBe(false);
  });

  // Verifier: BypassPermissionsSetCorrectly
  it('skipPermissions=true maps to bypassPermissions (unless plan) and no fork leakage', () => {
    const out = mapCliOptionsToSDK({
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: true },
    });
    expect(out.permissionMode).toBe('bypassPermissions');
    expect(Object.prototype.hasOwnProperty.call(out, 'resume')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'forkSession')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'resumeSessionAt')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, 'sessionId')).toBe(false);
  });

  // Extra: plan + skipPermissions should NOT set bypassPermissions (regression guard)
  it('plan mode with skipPermissions does NOT become bypassPermissions', () => {
    const out = mapCliOptionsToSDK({
      permissionMode: 'plan',
      toolsSettings: { allowedTools: [], disallowedTools: [], skipPermissions: true },
    });
    expect(out.permissionMode).toBe('plan');
  });
});
