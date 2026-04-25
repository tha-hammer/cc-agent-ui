import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  buildNolmeLaunchBinding,
  buildNolmeLaunchUrl,
} from '../../src/utils/nolmeLaunch';

describe('nolme launch binding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('derives the active binding from project/session plus persisted provider settings', () => {
    localStorage.setItem('selected-provider', 'claude');
    localStorage.setItem('claude-model', 'sonnet');
    localStorage.setItem('permissionMode-session-1', 'plan');
    localStorage.setItem(
      'claude-settings',
      JSON.stringify({
        allowedTools: ['Read'],
        disallowedTools: ['Bash'],
        skipPermissions: true,
      }),
    );

    const binding = buildNolmeLaunchBinding(
      { name: 'proj', displayName: 'Project', fullPath: '/repo/proj' } as any,
      { id: 'session-1', __provider: 'claude' } as any,
    );

    expect(binding).toEqual({
      provider: 'claude',
      sessionId: 'session-1',
      projectName: 'proj',
      projectPath: '/repo/proj',
      model: 'sonnet',
      permissionMode: 'plan',
      toolsSettings: {
        allowedTools: ['Read'],
        disallowedTools: ['Bash'],
        skipPermissions: true,
      },
    });
  });

  it('builds a /nolme URL with the binding encoded into query params', () => {
    const href = buildNolmeLaunchUrl({
      provider: 'claude',
      sessionId: 'session-1',
      projectName: 'proj',
      projectPath: '/repo/proj',
      model: 'sonnet',
      permissionMode: 'plan',
      toolsSettings: {
        allowedTools: ['Read'],
        disallowedTools: [],
        skipPermissions: true,
      },
    });

    expect(href).toContain('/nolme/?');
    expect(href).toContain('provider=claude');
    expect(href).toContain('sessionId=session-1');
    expect(href).toContain('projectName=proj');
    expect(href).toContain('projectPath=%2Frepo%2Fproj');
    expect(href).toContain('model=sonnet');
    expect(href).toContain('permissionMode=plan');
    expect(href).toContain('skipPermissions=1');
  });
});
