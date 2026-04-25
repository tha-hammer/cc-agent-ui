import { describe, expect, it } from 'vitest';
import { projectAiWorkingProjection } from '../../../src/lib/ai-working/projectAiWorkingProjection';
import { DEFAULT_NOLME_AGENT_STATE } from '../../../src/lib/types';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

const matchingActiveSkill = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectPath: '/workspace/demo-project',
  commandName: '/cs',
  argsText: 'token budget drift',
  metadata: { source: 'slash-command' },
  updatedAt: 99,
};

const historyMessages = [
  {
    id: 'assistant-algorithm',
    kind: 'text',
    role: 'assistant',
    content: 'ALGORITHM recap\n\n━━━ 👁️ OBSERVE\nLook around.\n\n━━━ 🧠 THINK\nReason about the task.\n\n━━━ 📋 PLAN\nLine up the steps.\n\n━━━ 🔨 BUILD\nChange the code.',
  },
  {
    id: 'deliverable-1',
    kind: 'tool_result',
    toolUseResult: {
      filePath: '/workspace/demo-project/docs/research-brief.md',
      newString: 'phase: build',
      originalFile: 'progress: 2/4',
    },
  },
];

describe('P0 · projectAiWorkingProjection', () => {
  it('returns a stable empty projection for empty input', () => {
    const result = projectAiWorkingProjection({ binding });

    expect(result.state).toEqual({ ...DEFAULT_NOLME_AGENT_STATE });
    expect(result.messages).toEqual([]);
    expect(result.activeSkill).toBeNull();
    expect(result.phases).toEqual([]);
    expect(result.deliverables).toEqual([]);
    expect(result.quickActions).toEqual([]);
    expect(result.empty).toEqual({
      messages: true,
      phases: true,
      resources: true,
      quickActions: true,
    });
  });

  it('projects history-only and state-only sessions from explicit inputs without reading globals', () => {
    const historyOnly = projectAiWorkingProjection({
      binding,
      messages: historyMessages,
      activeSkill: matchingActiveSkill,
    });

    expect(historyOnly.messages).toHaveLength(2);
    expect(historyOnly.activeSkill).toEqual(matchingActiveSkill);
    expect(historyOnly.phases).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'observe' }),
      expect.objectContaining({ id: 'think' }),
      expect.objectContaining({ id: 'plan' }),
      expect.objectContaining({ id: 'build' }),
    ]));
    expect(historyOnly.deliverables).toEqual([
      expect.objectContaining({
        title: 'Research Brief',
        filePath: '/workspace/demo-project/docs/research-brief.md',
      }),
    ]);
    expect(historyOnly.empty).toEqual({
      messages: false,
      phases: false,
      resources: false,
      quickActions: true,
    });

    const stateOnly = projectAiWorkingProjection({
      binding,
      state: {
        schemaVersion: 1,
        phases: [{ id: 'verify', label: 'Verify', title: 'Verify', status: 'active' }],
        currentPhaseIndex: 0,
        currentReviewLine: 'Explicit review line',
        resources: [{
          id: 'explicit-brief',
          badge: 'P2',
          title: 'Explicit brief',
          subtitle: 'Pinned resource',
          tone: 'iris',
          action: 'link',
          url: 'https://example.com/brief',
        }],
        profile: null,
        quickActions: ['Ship the patch'],
        taskNotifications: [],
      },
    });

    expect(stateOnly.messages).toEqual([]);
    expect(stateOnly.phases).toEqual([
      { id: 'verify', label: 'Verify', title: 'Verify', status: 'active' },
    ]);
    expect(stateOnly.deliverables).toEqual([
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
    expect(stateOnly.quickActions).toEqual(['Ship the patch']);
  });

  it('rejects active skill payloads whose identity does not match the session binding', () => {
    const result = projectAiWorkingProjection({
      binding,
      activeSkill: {
        ...matchingActiveSkill,
        projectPath: '/workspace/other-project',
      },
    });

    expect(result.activeSkill).toBeNull();
  });
});
