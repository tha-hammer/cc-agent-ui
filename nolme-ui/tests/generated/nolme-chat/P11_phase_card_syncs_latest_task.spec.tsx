import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: () => ({ state: undefined }),
}))

vi.mock('../../../src/hooks/useAiWorkingActiveSkill', () => ({
  useAiWorkingActiveSkill: () => null,
}))

import { WorkflowPhaseBarBoundV2 } from '../../../src/components/bindings/WorkflowPhaseBarBound.v2'
import { AiWorkingHydrationProvider } from '../../../src/hooks/useAiWorkingProjection'

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
}

describe('P11 · phase card syncs the latest task', () => {
  it('renders the latest quick-text task instead of stale progress text', () => {
    const hydration = {
      status: 'ready' as const,
      state: {
        schemaVersion: 1,
      },
      messages: [
        {
          id: 'algorithm',
          kind: 'text',
          role: 'assistant',
          content: [
            'ALGORITHM',
            '',
            '━━━ 👁️ OBSERVE',
            'Gather the current state.',
            '',
            '━━━ 🧠 THINK',
            'Interpret the signal.',
            '',
            '━━━ 📋 PLAN',
            'Choose the next move.',
          ].join('\n'),
        },
        {
          id: 'prd-progress',
          kind: 'tool_result',
          toolUseResult: {
            filePath: '/workspace/demo-project/PRD.md',
            oldString: 'phase: observe',
            newString: 'progress: 10/10',
            originalFile: 'phase: observe\nprogress: 9/10',
          },
        },
        {
          id: 'user-prompt',
          kind: 'text',
          role: 'user',
          content: 'Surface key unknowns',
        },
        {
          id: 'assistant-task',
          kind: 'text',
          role: 'assistant',
          content: '🗒️ TASK: Surface key unknowns across today\'s research',
        },
      ],
    }

    const { getByTestId } = render(
      <AiWorkingHydrationProvider binding={binding} hydration={hydration as any}>
        <WorkflowPhaseBarBoundV2 />
      </AiWorkingHydrationProvider>,
    )

    const detailCard = getByTestId('workflow-phase-detail-v2')

    expect(detailCard).toHaveTextContent('Surface key unknowns across today\'s research')
    expect(detailCard).not.toHaveTextContent('Progress 10/10')
  })
})
