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

  it('derives the active 3/7 algorithm state from assistant headers when the sidecar is empty', () => {
    const projection = projectPhaseTimeline([
      {
        id: 'algorithm-run',
        kind: 'text',
        role: 'assistant',
        content: [
          '♻︎ Entering the SAI ALGORITHM… (v3.8.1) ═════════════',
          '🗒️ TASK: Research laundromat business comprehensively',
          '',
          '━━━ 👁️ OBSERVE ━━━ 1/7',
          'Loaded the prior research context and identified the remaining gaps.',
          '',
          '━━━ 🧠 THINK ━━━ 2/7',
          'Risk: avoid duplicating the earlier laundromat research.',
          '',
          '━━━ 📋 PLAN ━━━ 3/7',
          'Research will be split into 3 parallel clusters.',
          '- Cluster A',
          '- Cluster B',
          '- Cluster C',
          '',
          '━━━ 🔨 BUILD ━━━ 4/7',
          '',
          '━━━ ⚡ EXECUTE ━━━ 5/7',
        ].join('\n'),
      },
    ])

    expect(projection.source).toBe('algorithm')
    expect(projection.phaseKey).toBe('plan')
    expect(projection.progress).toEqual({ current: 3, total: 7 })
    expect(projection.phases.map((phase) => phase.title)).toEqual([
      'Observe',
      'Think',
      'Plan',
      'Build',
      'Execute',
      'Verify',
      'Learn',
    ])
    expect(projection.phases.map((phase) => phase.status)).toEqual([
      'complete',
      'complete',
      'active',
      'idle',
      'idle',
      'idle',
      'idle',
    ])
  })

  it('ignores completed PRD state from an older run once a newer algorithm cycle starts', () => {
    const projection = projectPhaseTimeline([
      {
        id: 'older-complete',
        kind: 'tool_result',
        toolUseResult: {
          filePath: '/workspace/demo-project/PRD.md',
          content: [
            '---',
            'phase: complete',
            'progress: 16/16',
            '---',
          ].join('\n'),
        },
      },
      {
        id: 'new-cycle',
        kind: 'text',
        role: 'assistant',
        content: [
          '♻︎ Entering the SAI ALGORITHM… (v3.8.1) ═════════════',
          '🗒️ TASK: Research laundromat business comprehensively',
          '',
          '━━━ 👁️ OBSERVE ━━━ 1/7',
          'Loaded the prior research context and identified the remaining gaps.',
          '',
          '━━━ 🧠 THINK ━━━ 2/7',
          'Risk: avoid duplicating the earlier laundromat research.',
          '',
          '━━━ 📋 PLAN ━━━ 3/7',
          'Research will be split into 3 parallel clusters.',
          '',
          '━━━ 🔨 BUILD ━━━ 4/7',
          '',
          '━━━ ⚡ EXECUTE ━━━ 5/7',
        ].join('\n'),
      },
    ])

    expect(projection.source).toBe('algorithm')
    expect(projection.phaseKey).toBe('plan')
    expect(projection.progress).toEqual({ current: 3, total: 7 })
    expect(projection.phases.map((phase) => phase.status)).toEqual([
      'complete',
      'complete',
      'active',
      'idle',
      'idle',
      'idle',
      'idle',
    ])
  })
})
