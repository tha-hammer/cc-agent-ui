import { describe, expect, it } from 'vitest'

import { projectPhaseTimeline } from '../../../src/lib/ai-working/projectPhaseTimeline'
import type { AiWorkingMessage } from '../../../src/lib/ai-working/types'

const algorithmScaffold: AiWorkingMessage = {
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
}

describe('P11 · latest task review line', () => {
  it('prefers a newer assistant TASK line over older PRD progress text', () => {
    const projection = projectPhaseTimeline([
      algorithmScaffold,
      {
        id: 'prd-progress',
        kind: 'tool_result',
        toolUseResult: {
          filePath: '/workspace/demo/PRD.md',
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
    ])

    expect(projection.currentReviewLine).toBe('Surface key unknowns across today\'s research')
  })

  it('falls back to the latest user prompt when no assistant TASK line exists', () => {
    const projection = projectPhaseTimeline([
      algorithmScaffold,
      {
        id: 'prd-progress',
        kind: 'tool_result',
        toolUseResult: {
          filePath: '/workspace/demo/PRD.md',
          oldString: 'phase: observe',
          newString: 'progress: 10/10',
        },
      },
      {
        id: 'user-prompt',
        kind: 'text',
        role: 'user',
        content: 'Define the first step',
      },
      {
        id: 'assistant-answer',
        kind: 'text',
        role: 'assistant',
        content: 'Here is the first step I would take.',
      },
    ])

    expect(projection.currentReviewLine).toBe('Define the first step')
  })

  it('lets a newer PRD update supersede an older task prompt', () => {
    const projection = projectPhaseTimeline([
      algorithmScaffold,
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
        content: 'TASK: Surface key unknowns across today\'s research',
      },
      {
        id: 'prd-progress',
        kind: 'tool_result',
        toolUseResult: {
          filePath: '/workspace/demo/PRD.md',
          oldString: 'phase: think',
          newString: 'progress: 1/3',
        },
      },
    ])

    expect(projection.currentReviewLine).toBe('Progress 1/3')
  })
})
