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

  it('renders Plan as task 3 of 7 when only the plan header has substantive content', () => {
    const hydration = {
      status: 'ready' as const,
      state: {
        schemaVersion: 1,
      },
      messages: [
        {
          id: 'algorithm-run',
          kind: 'text',
          role: 'assistant',
          content: [
            '♻︎ Entering the SAI ALGORITHM… (v3.8.1) ═════════════',
            '🗒️ TASK: Research laundromat business comprehensively',
            '',
            '━━━ 👁️ OBSERVE ━━━ 1/7',
            'Loaded the prior research context.',
            '',
            '━━━ 🧠 THINK ━━━ 2/7',
            'Checked for duplication risk.',
            '',
            '━━━ 📋 PLAN ━━━ 3/7',
            'Research will be split into 3 parallel clusters.',
            '',
            '━━━ 🔨 BUILD ━━━ 4/7',
            '',
            '━━━ ⚡ EXECUTE ━━━ 5/7',
          ].join('\n'),
        },
      ],
    }

    const { getByTestId } = render(
      <AiWorkingHydrationProvider binding={binding} hydration={hydration as any}>
        <WorkflowPhaseBarBoundV2 />
      </AiWorkingHydrationProvider>,
    )

    const detailCard = getByTestId('workflow-phase-detail-v2')

    expect(detailCard).toHaveTextContent('Plan')
    expect(detailCard).toHaveTextContent('Task 3 of 7')
    expect(getByTestId('workflow-phase-status-v2')).toHaveTextContent('Active')
  })

  it('focuses the last phase when the latest run is complete', () => {
    const hydration = {
      status: 'ready' as const,
      state: {
        schemaVersion: 1,
      },
      messages: [
        {
          id: 'completed-run',
          kind: 'text',
          role: 'assistant',
          content: [
            '♻︎ Entering the SAI ALGORITHM… (v3.8.1) ═════════════',
            '🗒️ TASK: Research laundromat business remaining angles',
            '',
            '━━━ 👁️ OBSERVE ━━━ 1/7',
            'Loaded prior context.',
            '',
            '━━━ 🧠 THINK ━━━ 2/7',
            'Pressure tested the remaining gaps.',
            '',
            '━━━ ✅ VERIFY ━━━ 6/7',
            'All research clusters returned.',
          ].join('\n'),
        },
        {
          id: 'completed-prd',
          kind: 'tool_result',
          toolUseResult: {
            filePath: '/workspace/demo-project/PRD.md',
            newString: 'phase: complete\nprogress: 20/20',
            originalFile: 'phase: think\nprogress: 0/20',
          },
        },
        {
          id: 'learn-summary',
          kind: 'text',
          role: 'assistant',
          content: [
            '━━━ 📚 LEARN ━━━ 7/7',
            '',
            'Silmari unavailable this run — memory integration skipped.',
          ].join('\n'),
        },
      ],
    }

    const { getByTestId } = render(
      <AiWorkingHydrationProvider binding={binding} hydration={hydration as any}>
        <WorkflowPhaseBarBoundV2 />
      </AiWorkingHydrationProvider>,
    )

    const detailCard = getByTestId('workflow-phase-detail-v2')

    expect(detailCard).toHaveTextContent('Learn')
    expect(detailCard).toHaveTextContent('Task 7 of 7')
    expect(getByTestId('workflow-phase-status-v2')).toHaveTextContent('Done')
  })
})
