import type { NolmeResource } from '../types'
import type { AiWorkingDeliverable, AiWorkingMessage } from './types'
import { BADGE_TONE } from './types'
import { extractConversationState, projectPhaseTimeline } from './projectPhaseTimeline'

type Candidate = AiWorkingDeliverable & {
  dedupeKey: string
  sourceRank: number
  index: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? filePath
}

function getParentName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : ''
}

function humanizeToken(value: string): string {
  const cleaned = value
    .replace(/^[0-9]{8}[-_][0-9]{6}[_-]?/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (!cleaned) {
    return ''
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function createId(prefix: string, seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${slug || 'item'}`
}

function badgeFromProgress(current: number, total: number): NolmeResource['badge'] {
  if (total <= 0) {
    return 'P1'
  }

  const ratio = current / total
  if (ratio >= 0.75) return 'P4'
  if (ratio >= 0.5) return 'P3'
  if (ratio >= 0.25) return 'P2'
  return 'P1'
}

function badgeFromPhaseIndex(index: number, total: number): NolmeResource['badge'] {
  if (index < 0 || total <= 0) {
    return 'P1'
  }

  const bucket = Math.ceil(((index + 1) / total) * 4)
  return `P${Math.max(1, Math.min(bucket, 4))}` as NolmeResource['badge']
}

function deriveBadge(messages: AiWorkingMessage[], inclusiveIndex: number): NolmeResource['badge'] {
  const state = extractConversationState(messages, inclusiveIndex)
  if (state.phaseKey === 'complete' || state.markers.completed) {
    return 'P4'
  }

  if (state.progress) {
    return badgeFromProgress(state.progress.current, state.progress.total)
  }

  const phaseProjection = projectPhaseTimeline(messages.slice(0, inclusiveIndex + 1))
  if (state.phaseKey) {
    const phaseIndex = phaseProjection.phases.findIndex(
      (phase) => phase.title.toLowerCase() === state.phaseKey,
    )
    if (phaseIndex >= 0) {
      return badgeFromPhaseIndex(phaseIndex, phaseProjection.phases.length)
    }
  }

  return 'P1'
}

function createFileDeliverable(
  messages: AiWorkingMessage[],
  message: AiWorkingMessage,
  index: number,
): Candidate | null {
  if (message.kind !== 'tool_result' || !isRecord(message.toolUseResult)) {
    return null
  }

  const filePath = asString(message.toolUseResult.filePath)
  if (!filePath) {
    return null
  }

  if (filePath.includes('/.claude/SAI/')) {
    return null
  }

  const badge = deriveBadge(messages, index)
  const fileName = getFileName(filePath)
  const isPrd = fileName.toLowerCase() === 'prd.md'
  const title = isPrd
    ? `${humanizeToken(getParentName(filePath)) || 'Session'} PRD`
    : humanizeToken(fileName) || fileName

  return {
    id: createId('deliverable', filePath),
    dedupeKey: `file:${filePath.toLowerCase()}`,
    badge,
    tone: BADGE_TONE[badge],
    title,
    subtitle: `Updated file: ${fileName}`,
    action: 'download',
    source: 'file',
    filePath,
    sourceRank: 1,
    index,
  }
}

function createResourceDeliverable(message: AiWorkingMessage, index: number): Candidate | null {
  if (message.kind !== 'tool_use' || message.toolName !== 'addResource' || !isRecord(message.toolInput)) {
    return null
  }

  const badge = asString(message.toolInput.badge)
  const title = asString(message.toolInput.title)
  const subtitle = asString(message.toolInput.subtitle)
  const tone = asString(message.toolInput.tone)
  const action = asString(message.toolInput.action)
  const url = asString(message.toolInput.url) ?? undefined
  const id = asString(message.toolInput.id) ?? createId('deliverable', `${title ?? ''}-${subtitle ?? ''}`)

  if (
    (badge !== 'P1' && badge !== 'P2' && badge !== 'P3' && badge !== 'P4')
    || !title
    || !subtitle
    || (tone !== 'emerald' && tone !== 'iris' && tone !== 'gold')
    || (action !== 'download' && action !== 'link')
  ) {
    return null
  }

  return {
    id,
    dedupeKey: `resource:${id}`,
    badge,
    tone,
    title,
    subtitle,
    action,
    url,
    source: 'addResource',
    sourceRank: 0,
    index,
  }
}

function createSummaryDeliverable(messages: AiWorkingMessage[]): Candidate | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.kind !== 'text' || message.role !== 'assistant') {
      continue
    }

    const content = asString(message.content) ?? asString(message.text)
    if (!content) {
      continue
    }

    const completed = content.match(/^COMPLETED:\s*(.+)$/im)
    if (!completed?.[1]) {
      continue
    }

    const summary = completed[1].trim()
    const badge = deriveBadge(messages, index)

    return {
      id: createId('deliverable', summary),
      dedupeKey: `summary:${summary.toLowerCase()}`,
      badge,
      tone: BADGE_TONE[badge],
      title: 'Completion summary',
      subtitle: summary,
      action: 'download',
      source: 'summary',
      sourceRank: 2,
      index,
    }
  }

  return null
}

function mergeCandidate(map: Map<string, Candidate>, candidate: Candidate): void {
  const existing = map.get(candidate.dedupeKey)
  if (!existing) {
    map.set(candidate.dedupeKey, candidate)
    return
  }

  if (candidate.sourceRank < existing.sourceRank) {
    map.set(candidate.dedupeKey, candidate)
    return
  }

  if (candidate.sourceRank === existing.sourceRank && candidate.index >= existing.index) {
    map.set(candidate.dedupeKey, candidate)
  }
}

/**
 * @rr.id [PROPOSED] rr.nolme.deliverables_panel
 * @rr.alias projectDeliverables
 * @path.id ai-working-deliverables
 * @gwt.given normalized conversation history without explicit resources
 * @gwt.when projectDeliverables executes
 * @gwt.then derives deliverable cards from artifact-producing tool results
 */
export function projectDeliverables(messages: AiWorkingMessage[]): AiWorkingDeliverable[] {
  const candidates = new Map<string, Candidate>()
  let hasConcreteArtifact = false

  messages.forEach((message, index) => {
    const resourceCandidate = createResourceDeliverable(message, index)
    if (resourceCandidate) {
      hasConcreteArtifact = true
      mergeCandidate(candidates, resourceCandidate)
    }

    const fileCandidate = createFileDeliverable(messages, message, index)
    if (fileCandidate) {
      hasConcreteArtifact = true
      mergeCandidate(candidates, fileCandidate)
    }
  })

  if (!hasConcreteArtifact) {
    const summaryCandidate = createSummaryDeliverable(messages)
    if (summaryCandidate) {
      mergeCandidate(candidates, summaryCandidate)
    }
  }

  return Array.from(candidates.values())
    .sort((left, right) => left.index - right.index)
    .map(({ dedupeKey: _dedupeKey, sourceRank: _sourceRank, index: _index, ...deliverable }) => deliverable)
}
