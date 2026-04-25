import { describe, expect, it } from 'vitest';
import { projectAiWorkingProjection } from '../../../src/lib/ai-working/projectAiWorkingProjection';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

const contradictoryConversation = [
  {
    id: 'assistant-algorithm',
    kind: 'text',
    role: 'assistant',
    content: 'ALGORITHM recap\n\n━━━ 👁️ OBSERVE\nLook around.\n\n━━━ 🧠 THINK\nReason about the task.\n\n━━━ 📋 PLAN\nLine up the steps.\n\n━━━ 🔨 BUILD\nChange the code.',
  },
  {
    id: 'phase-hint',
    kind: 'tool_result',
    toolUseResult: {
      filePath: '/workspace/demo-project/docs/PRD.md',
      newString: 'phase: complete',
      originalFile: 'progress: 17/17',
    },
  },
  {
    id: 'summary',
    kind: 'text',
    role: 'assistant',
    content: 'COMPLETED: Conversation fallback says the work is done.',
  },
];

describe('P1 · ai-working merge precedence', () => {
  it('treats explicit phases, resources, and quickActions as authoritative over conversation fallback', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: contradictoryConversation,
      state: {
        schemaVersion: 1,
        phases: [{ id: 'observe', label: 'Observe', title: 'Observe', status: 'active' }],
        currentPhaseIndex: 0,
        currentReviewLine: 'Explicit review line',
        resources: [{
          id: 'explicit-brief',
          badge: 'P2',
          title: 'Explicit brief',
          subtitle: 'Pinned resource',
          tone: 'gold',
          action: 'link',
          url: 'https://example.com/brief',
        }],
        profile: null,
        quickActions: [],
        taskNotifications: [],
      },
    });

    expect(result.phases).toEqual([
      { id: 'observe', label: 'Observe', title: 'Observe', status: 'active' },
    ]);
    expect(result.state.currentReviewLine).toBe('Explicit review line');
    expect(result.deliverables).toEqual([
      {
        id: 'explicit-brief',
        badge: 'P2',
        title: 'Explicit brief',
        subtitle: 'Pinned resource',
        tone: 'gold',
        action: 'link',
        url: 'https://example.com/brief',
      },
    ]);
    expect(result.quickActions).toEqual([]);
    expect(result.explicit).toEqual({
      phases: true,
      resources: true,
      quickActions: true,
    });
  });

  it('fills only the missing slices from conversation fallback when explicit state is partial', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: contradictoryConversation,
      state: {
        schemaVersion: 1,
        resources: [{
          id: 'explicit-brief',
          badge: 'P2',
          title: 'Explicit brief',
          subtitle: 'Pinned resource',
          tone: 'iris',
          action: 'link',
          url: 'https://example.com/brief',
        }],
      },
    });

    expect(result.phases).not.toEqual([]);
    expect(result.phases).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'observe' }),
      expect.objectContaining({ id: 'build' }),
    ]));
    expect(result.deliverables).toEqual([
      {
        id: 'explicit-brief',
        badge: 'P2',
        title: 'Explicit brief',
        subtitle: 'Pinned resource',
        tone: 'iris',
        action: 'link',
        url: 'https://example.com/brief',
      },
    ]);
    expect(result.explicit).toEqual({
      phases: false,
      resources: true,
      quickActions: false,
    });
  });
});
