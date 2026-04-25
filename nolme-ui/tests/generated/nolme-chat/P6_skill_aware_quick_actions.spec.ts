import { describe, expect, it } from 'vitest';

import { projectSkillQuickActions } from '../../../src/components/bindings/projectSkillQuickActions';

describe('P6 · projectSkillQuickActions', () => {
  it('prefers active skill-derived actions over explicit state quick actions', () => {
    const actions = projectSkillQuickActions({
      activeSkill: {
        provider: 'claude',
        sessionId: 'session-1',
        projectPath: '/workspace/demo-project',
        commandName: '/create_tdd_plan',
        argsText: 'nolme phase 3',
        metadata: {
          description: 'Create a TDD implementation plan from research.',
        },
        updatedAt: 100,
      },
      explicitQuickActions: ['Fallback A', 'Fallback B'],
      phases: [],
      currentPhaseIndex: 0,
    });

    expect(actions[0]).toContain('Create tdd plan');
    expect(actions[0]).toContain('nolme phase 3');
    expect(actions).not.toContain('Fallback A');
  });

  it('falls back to explicit state quick actions when no active skill exists', () => {
    const actions = projectSkillQuickActions({
      activeSkill: null,
      explicitQuickActions: ['Draft brief', 'Summarize context'],
      phases: [],
      currentPhaseIndex: 0,
    });

    expect(actions).toEqual(['Draft brief', 'Summarize context']);
  });

  it('falls back to deterministic phase defaults when both active skill and state are empty', () => {
    const actions = projectSkillQuickActions({
      activeSkill: null,
      explicitQuickActions: [],
      phases: [
        { id: 'phase-plan', label: 'Plan', title: 'Plan', status: 'active' },
      ],
      currentPhaseIndex: 0,
    });

    expect(actions).toEqual(['Draft the plan', 'Sequence the work', 'Call out dependencies']);
  });
});
