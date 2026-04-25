import { describe, expect, it } from 'vitest';
import { normalizeNolmeState } from '../../../src/lib/ai-working/normalizeNolmeState';
import { DEFAULT_NOLME_AGENT_STATE } from '../../../src/lib/types';

describe('P00 · normalizeNolmeState', () => {
  it('fills defaults while preserving valid ai-working slices from mixed-quality input', () => {
    const result = normalizeNolmeState({
      schemaVersion: 1,
      phases: [{ id: 'build' }, { nope: true }],
      resources: [
        {
          title: 'Research brief',
          subtitle: 'Latest draft',
          badge: 'P3',
          action: 'link',
          tone: 'gold',
          url: 'https://example.com/brief',
        },
        {
          title: 'broken resource',
        },
      ],
      profile: {
        name: 'Aria',
        role: 'Research lead',
        skills: ['Planning', '', null],
        integrations: ['Claude', 4],
        usageValue: 82,
      },
      quickActions: ['Summarize findings', '', 42],
      taskNotifications: [
        { status: 'done', summary: 'Outline shipped', ts: 1234 },
        { status: 'bad', summary: '', ts: 'later' },
      ],
      tokenBudget: {
        provider: 'claude',
        used: '12',
      },
      activeSkill: {
        provider: 'claude',
        sessionId: 's-1',
        projectPath: '/workspace/demo',
        commandName: '/cs',
        argsText: 'token budget drift',
        metadata: { source: 'slash-command' },
        updatedAt: 99,
      },
    });

    expect(result.state).toEqual({
      schemaVersion: 1,
      phases: [{ id: 'build', label: 'Build', title: 'Build', status: 'idle' }],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [{
        id: 'research-brief',
        badge: 'P3',
        title: 'Research brief',
        subtitle: 'Latest draft',
        tone: 'gold',
        action: 'link',
        url: 'https://example.com/brief',
      }],
      profile: {
        name: 'Aria',
        role: 'Research lead',
        skills: ['Planning'],
        integrations: ['Claude'],
        usageValue: 82,
      },
      quickActions: ['Summarize findings'],
      taskNotifications: [{ status: 'done', summary: 'Outline shipped', ts: 1234 }],
      tokenBudget: {
        provider: 'claude',
        used: '12',
      },
      activeSkill: {
        provider: 'claude',
        sessionId: 's-1',
        projectPath: '/workspace/demo',
        commandName: '/cs',
        argsText: 'token budget drift',
        metadata: { source: 'slash-command' },
        updatedAt: 99,
      },
    });
    expect(result.explicit).toEqual({
      phases: true,
      resources: true,
      quickActions: true,
    });
  });

  it('drops invalid active skill payloads and falls back to defaults for invalid root input', () => {
    expect(
      normalizeNolmeState({
        activeSkill: {
          provider: 'claude',
          sessionId: 's-1',
          commandName: '/cs',
          argsText: 'missing project path',
          updatedAt: 1,
        },
      }).state,
    ).toEqual({
      ...DEFAULT_NOLME_AGENT_STATE,
      activeSkill: null,
    });

    expect(normalizeNolmeState('not-an-object').state).toEqual({
      ...DEFAULT_NOLME_AGENT_STATE,
    });
  });
});
