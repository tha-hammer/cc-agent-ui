import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useCoAgentSpy,
  useAiWorkingActiveSkillSpy,
  coAgentStateRef,
} = vi.hoisted(() => ({
  useCoAgentSpy: vi.fn(),
  useAiWorkingActiveSkillSpy: vi.fn(),
  coAgentStateRef: { current: undefined as unknown },
}));

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: (config: unknown) => {
    useCoAgentSpy(config);
    return { state: coAgentStateRef.current };
  },
}));

vi.mock('../../../src/hooks/useAiWorkingActiveSkill', () => ({
  useAiWorkingActiveSkill: (binding: unknown) => useAiWorkingActiveSkillSpy(binding),
}));

import {
  AiWorkingHydrationProvider,
  useAiWorkingProjection,
} from '../../../src/hooks/useAiWorkingProjection';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

const hydration = {
  status: 'ready' as const,
  messages: [
    {
      id: 'deliverable-1',
      kind: 'tool_result',
      toolUseResult: {
        filePath: '/workspace/demo-project/docs/research-brief.md',
      },
    },
  ],
  state: {
    schemaVersion: 1,
    phases: [{ id: 'observe' }],
    quickActions: ['Summarize the brief'],
  },
};

describe('P00 · ai-working hydration bridge', () => {
  beforeEach(() => {
    useCoAgentSpy.mockReset();
    useAiWorkingActiveSkillSpy.mockReset();
    useAiWorkingActiveSkillSpy.mockReturnValue(null);
    coAgentStateRef.current = undefined;
  });

  it('projects hydrated messages and persisted state on first render before live CoAgent updates', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AiWorkingHydrationProvider binding={binding} hydration={hydration as any}>
        {children}
      </AiWorkingHydrationProvider>
    );

    const { result } = renderHook(() => useAiWorkingProjection(), { wrapper });

    expect(useAiWorkingActiveSkillSpy).toHaveBeenCalledWith(binding);
    expect(useCoAgentSpy).toHaveBeenCalledWith(expect.objectContaining({
      name: 'ccu',
      initialState: expect.objectContaining({
        schemaVersion: 1,
        phases: expect.arrayContaining([
          expect.objectContaining({ id: 'observe' }),
        ]),
        quickActions: ['Summarize the brief'],
        currentPhaseIndex: 0,
        currentReviewLine: '',
      }),
    }));

    expect(result.current.messages).toEqual(hydration.messages);
    expect(result.current.phases).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'observe' }),
    ]));
    expect(result.current.quickActions).toEqual(['Summarize the brief']);
    expect(result.current.deliverables).toEqual([
      expect.objectContaining({
        filePath: '/workspace/demo-project/docs/research-brief.md',
      }),
    ]);
  });
});
