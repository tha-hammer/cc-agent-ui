import { describe, expect, it } from 'vitest'

import fixture from '../../fixtures/ai-working/example-session.normalized.json'
import { projectDeliverables } from '../../../src/lib/ai-working/projectDeliverables'
import type { AiWorkingMessage } from '../../../src/lib/ai-working/types'

const messages = fixture as AiWorkingMessage[]

describe('P3 · projectDeliverables', () => {
  it('de-duplicates repeated file edits and ignores non-artifact reads', () => {
    const deliverables = projectDeliverables(messages)

    expect(deliverables).toHaveLength(1)
    expect(deliverables[0]).toMatchObject({
      source: 'file',
      badge: 'P4',
      title: 'Car Wash Membership Business Model PRD',
      subtitle: 'Updated file: PRD.md',
      action: 'download',
    })
  })

  it('prefers explicit addResource payloads when workflow tools emitted them in history', () => {
    const deliverables = projectDeliverables([
      {
        id: 'resource-tool',
        timestamp: '2026-04-25T12:00:00.000Z',
        kind: 'tool_use',
        toolName: 'addResource',
        toolInput: {
          id: 'brief',
          badge: 'P2',
          title: 'Campaign brief',
          subtitle: 'Google Doc',
          tone: 'iris',
          action: 'link',
          url: 'https://example.com/brief',
        },
      },
    ])

    expect(deliverables).toEqual([
      {
        id: 'brief',
        badge: 'P2',
        title: 'Campaign brief',
        subtitle: 'Google Doc',
        tone: 'iris',
        action: 'link',
        url: 'https://example.com/brief',
        source: 'addResource',
      },
    ])
  })

  it('falls back to the COMPLETED summary when no concrete artifact path exists', () => {
    const deliverables = projectDeliverables([
      {
        id: 'summary-only',
        timestamp: '2026-04-25T15:31:28.220Z',
        kind: 'text',
        role: 'assistant',
        content: 'COMPLETED: Delivered the final audit summary with cited sources.',
      },
    ])

    expect(deliverables).toEqual([
      {
        id: 'deliverable-delivered-the-final-audit-summary-with-cited-sources',
        badge: 'P4',
        title: 'Completion summary',
        subtitle: 'Delivered the final audit summary with cited sources.',
        tone: 'gold',
        action: 'download',
        source: 'summary',
      },
    ])
  })
})
