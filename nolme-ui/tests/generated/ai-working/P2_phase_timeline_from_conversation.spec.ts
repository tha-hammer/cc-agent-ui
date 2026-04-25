import { describe, expect, it } from 'vitest'

import fixture from '../../fixtures/ai-working/example-session.normalized.json'
import { projectPhaseTimeline } from '../../../src/lib/ai-working/projectPhaseTimeline'
import type { AiWorkingMessage } from '../../../src/lib/ai-working/types'

const messages = fixture as AiWorkingMessage[]

describe('P2 · projectPhaseTimeline', () => {
  it('keeps deterministic algorithm ordering even when assistant messages repeat the scaffold', () => {
    const projection = projectPhaseTimeline(messages)

    expect(projection.source).toBe('prd')
    expect(projection.phases.map((phase) => phase.title)).toEqual([
      'Observe',
      'Think',
      'Plan',
      'Build',
      'Execute',
      'Verify',
      'Learn',
    ])
  })

  it('marks prior phases complete and the current PRD phase active before the completion patch lands', () => {
    const projection = projectPhaseTimeline(messages.slice(0, 5))

    expect(projection.currentReviewLine).toBe('Progress 17/17')
    expect(projection.phases.map((phase) => phase.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'active',
      'idle',
      'idle',
      'idle',
    ])
  })

  it('marks the whole timeline complete once the PRD phase changes to complete', () => {
    const projection = projectPhaseTimeline(messages)

    expect(projection.phaseKey).toBe('complete')
    expect(projection.phases.every((phase) => phase.status === 'complete')).toBe(true)
  })

  it('falls back to a single complete phase when PRD history has no intermediate headers', () => {
    const projection = projectPhaseTimeline([
      {
        id: 'only-complete',
        timestamp: '2026-04-25T15:30:36.980Z',
        kind: 'tool_result',
        content: 'PRD updated',
        toolUseResult: {
          filePath: '/tmp/PRD.md',
          oldString: 'phase: build',
          newString: 'phase: complete',
          originalFile: 'phase: build\nprogress: 17/17',
        },
      },
    ])

    expect(projection.phases).toEqual([
      {
        id: 'complete',
        label: 'Complete',
        title: 'Complete',
        status: 'complete',
      },
    ])
  })
})
