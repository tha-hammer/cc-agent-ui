import type { NolmePhase } from '../types'
import type {
  AiWorkingConversationState,
  AiWorkingMarkerState,
  AiWorkingMessage,
  AiWorkingPhaseKey,
  AiWorkingPhaseProjection,
  AiWorkingProgress,
} from './types'
import { AI_WORKING_PHASES, PHASE_TITLES } from './types'

const PHASE_ORDER: AiWorkingPhaseKey[] = AI_WORKING_PHASES.map((phase) => phase.key)
const MARKER_ORDER = ['capture', 'next', 'completed'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getAssistantText(message: AiWorkingMessage): string | null {
  if (message.kind !== 'text' || message.role !== 'assistant') {
    return null
  }

  return asString(message.content) ?? asString(message.text)
}

function getUserText(message: AiWorkingMessage): string | null {
  if (message.kind !== 'text' || message.role !== 'user') {
    return null
  }

  return asString(message.content) ?? asString(message.text)
}

function extractAssistantTaskLine(content: string): string | null {
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const normalizedLine = line.trim().replace(/^[^A-Za-z0-9]+/, '').trim()
    const match = normalizedLine.match(/^TASK:\s*(.+)$/i)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return null
}

function normalizePhaseKey(value: string | null | undefined): AiWorkingPhaseKey | null {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase().trim().replace(/[^a-z]+/g, ' ')
  if (normalized.includes('observe')) return 'observe'
  if (normalized.includes('think')) return 'think'
  if (normalized.includes('plan')) return 'plan'
  if (normalized.includes('build')) return 'build'
  if (normalized.includes('execute')) return 'execute'
  if (normalized.includes('verify')) return 'verify'
  if (normalized.includes('learn')) return 'learn'
  if (normalized.includes('complete') || normalized.includes('done')) return 'complete'
  return null
}

function extractAlgorithmPhaseKeys(messages: AiWorkingMessage[]): Array<Exclude<AiWorkingPhaseKey, 'complete'>> {
  const orderedKeys: Array<Exclude<AiWorkingPhaseKey, 'complete'>> = []

  for (const message of messages) {
    const text = getAssistantText(message)
    if (!text || !text.toUpperCase().includes('ALGORITHM')) {
      continue
    }

    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      for (const phase of AI_WORKING_PHASES) {
        const phaseKey = phase.key as Exclude<AiWorkingPhaseKey, 'complete'>
        if (line.startsWith(phase.header) && !orderedKeys.includes(phaseKey)) {
          orderedKeys.push(phaseKey)
        }
      }
    }
  }

  return orderedKeys
}

function extractMarkers(content: string, markers: AiWorkingMarkerState): void {
  const capture = content.match(/^CAPTURE:\s*(.+)$/im)
  const next = content.match(/^NEXT:\s*(.+)$/im)
  const completed = content.match(/^COMPLETED:\s*(.+)$/im)

  if (capture?.[1]) {
    markers.capture = capture[1].trim()
  }
  if (next?.[1]) {
    markers.next = next[1].trim()
  }
  if (completed?.[1]) {
    markers.completed = completed[1].trim()
  }
}

function extractPhaseSignals(payload: Record<string, unknown>): {
  phaseKey: AiWorkingPhaseKey | null
  progress: AiWorkingProgress | null
} {
  const snippets = [
    asString(payload.newString),
    asString(payload.oldString),
    asString(payload.originalFile),
    asString(payload.content),
  ].filter((value): value is string => Boolean(value))

  let phaseKey: AiWorkingPhaseKey | null = null
  let progress: AiWorkingProgress | null = null

  for (const snippet of snippets) {
    const phaseMatch = snippet.match(/\bphase:\s*([a-z_-]+)/i)
    if (phaseMatch && !phaseKey) {
      phaseKey = normalizePhaseKey(phaseMatch[1])
    }

    const progressMatch = snippet.match(/\bprogress:\s*(\d+)\s*\/\s*(\d+)/i)
    if (progressMatch && !progress) {
      progress = {
        current: Number.parseInt(progressMatch[1], 10),
        total: Number.parseInt(progressMatch[2], 10),
      }
    }
  }

  return { phaseKey, progress }
}

function getToolUseResultPayload(message: AiWorkingMessage): Record<string, unknown> | null {
  if (message.kind === 'tool_result' && isRecord(message.toolUseResult)) {
    return message.toolUseResult
  }

  if (message.kind === 'tool_use' && isRecord(message.toolResult?.toolUseResult)) {
    return message.toolResult.toolUseResult
  }

  return null
}

export function extractConversationState(
  messages: AiWorkingMessage[],
  inclusiveIndex = messages.length - 1,
): AiWorkingConversationState {
  let phaseKey: AiWorkingPhaseKey | null = null
  let progress: AiWorkingProgress | null = null
  const markers: AiWorkingMarkerState = {}

  for (let index = 0; index <= inclusiveIndex; index += 1) {
    const message = messages[index]
    if (!message) {
      continue
    }

    const assistantText = getAssistantText(message)
    if (assistantText) {
      extractMarkers(assistantText, markers)
    }

    const payload = getToolUseResultPayload(message)
    if (!payload) {
      continue
    }

    const signals = extractPhaseSignals(payload)
    if (signals.phaseKey) {
      phaseKey = signals.phaseKey
    }
    if (signals.progress) {
      progress = signals.progress
    }
  }

  return { phaseKey, progress, markers }
}

function normalizeWorkflowToolPhase(value: unknown): NolmePhase | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const label = asString(value.label)
  const title = asString(value.title)
  const status = asString(value.status)

  if (!id || !label || !title) {
    return null
  }

  if (status !== 'idle' && status !== 'active' && status !== 'complete') {
    return null
  }

  return { id, label, title, status }
}

function ensureWorkflowToolStatuses(phases: NolmePhase[], currentPhaseIndex: number | null): NolmePhase[] {
  const next = phases.map((phase) => ({ ...phase }))

  if (currentPhaseIndex === null || currentPhaseIndex < 0 || currentPhaseIndex >= next.length) {
    const activeIndex = next.findIndex((phase) => phase.status === 'active')
    if (activeIndex >= 0) {
      return next
    }

    const firstIncomplete = next.findIndex((phase) => phase.status !== 'complete')
    if (firstIncomplete >= 0) {
      next[firstIncomplete].status = 'active'
    }
    return next
  }

  for (let index = 0; index < next.length; index += 1) {
    if (index < currentPhaseIndex) {
      next[index].status = 'complete'
    } else if (index === currentPhaseIndex) {
      next[index].status = 'active'
    } else if (next[index].status === 'complete') {
      next[index].status = 'idle'
    }
  }

  return next
}

function projectFromWorkflowTools(messages: AiWorkingMessage[]): AiWorkingPhaseProjection | null {
  let phases: NolmePhase[] | null = null
  let currentReviewLine = ''

  for (const message of messages) {
    if (message.kind !== 'tool_use') {
      continue
    }

    if (message.toolName === 'setPhaseState' && isRecord(message.toolInput)) {
      const nextPhases = Array.isArray(message.toolInput.phases)
        ? message.toolInput.phases
            .map((phase) => normalizeWorkflowToolPhase(phase))
            .filter((phase): phase is NolmePhase => Boolean(phase))
        : []

      if (nextPhases.length > 0) {
        phases = ensureWorkflowToolStatuses(nextPhases, asNumber(message.toolInput.currentPhaseIndex))
      }

      currentReviewLine = asString(message.toolInput.currentReviewLine) ?? currentReviewLine
      continue
    }

    if (message.toolName === 'advancePhase' && phases && isRecord(message.toolInput)) {
      const phaseId = asString(message.toolInput.phaseId)
      if (!phaseId) {
        continue
      }

      const phaseIndex = phases.findIndex((phase) => phase.id === phaseId)
      if (phaseIndex < 0) {
        continue
      }

      phases = phases.map((phase, index) => {
        if (index < phaseIndex + 1) {
          return { ...phase, status: 'complete' }
        }
        if (index === phaseIndex + 1) {
          return { ...phase, status: 'active' }
        }
        return { ...phase, status: 'idle' }
      })
    }
  }

  if (!phases || phases.length === 0) {
    return null
  }

  const activePhase = phases.find((phase) => phase.status === 'active') ?? null

  return {
    phases,
    currentReviewLine,
    phaseKey: normalizePhaseKey(activePhase?.title),
    progress: null,
    source: 'workflow-tool',
  }
}

function createPhase(label: string, title: string, status: NolmePhase['status']): NolmePhase {
  return {
    id: title.toLowerCase().replace(/\s+/g, '-'),
    label,
    title,
    status,
  }
}

function buildMarkerPhases(markers: AiWorkingMarkerState): NolmePhase[] {
  const seenKeys = MARKER_ORDER.filter((key) => Boolean(markers[key]))
  if (seenKeys.length === 0) {
    return []
  }

  const highestKey = seenKeys[seenKeys.length - 1]
  const highestIndex = MARKER_ORDER.indexOf(highestKey)

  return seenKeys.map((key, index) => {
    if (highestKey === 'completed') {
      return createPhase(`Phase ${index + 1}`, PHASE_TITLES.complete, 'complete')
    }

    if (index < highestIndex) {
      return createPhase(`Phase ${index + 1}`, key === 'capture' ? 'Capture' : 'Next', 'complete')
    }

    return createPhase(`Phase ${index + 1}`, key === 'capture' ? 'Capture' : 'Next', 'active')
  })
}

function buildPhases(
  phaseKeys: AiWorkingPhaseKey[],
  state: AiWorkingConversationState,
): NolmePhase[] {
  if (phaseKeys.length === 0) {
    return []
  }

  const phases = phaseKeys.map((phaseKey, index) =>
    createPhase(
      phaseKeys.length === 1 && phaseKey === 'complete' ? 'Complete' : `Phase ${index + 1}`,
      PHASE_TITLES[phaseKey],
      'idle',
    ),
  )

  if (state.phaseKey === 'complete' || state.markers.completed) {
    return phases.map((phase) => ({ ...phase, status: 'complete' }))
  }

  const activeIndex = state.phaseKey ? phaseKeys.indexOf(state.phaseKey) : -1
  if (activeIndex >= 0) {
    return phases.map((phase, index) => {
      if (index < activeIndex) {
        return { ...phase, status: 'complete' }
      }
      if (index === activeIndex) {
        return { ...phase, status: 'active' }
      }
      return phase
    })
  }

  return phases.map((phase, index) => (index === 0 ? { ...phase, status: 'active' } : phase))
}

function formatReviewLine(progress: AiWorkingProgress | null): string {
  if (!progress) {
    return ''
  }

  return `Progress ${progress.current}/${progress.total}`
}

function resolveCurrentReviewLine(
  messages: AiWorkingMessage[],
  progress: AiWorkingProgress | null,
): string {
  const progressLine = formatReviewLine(progress)
  let latestProgressSignalIndex = -1
  let latestTaskLikeSignal: { index: number; text: string } | null = null

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (!message) {
      continue
    }

    const assistantText = getAssistantText(message)
    if (assistantText) {
      const taskLine = extractAssistantTaskLine(assistantText)
      if (taskLine) {
        latestTaskLikeSignal = { index, text: taskLine }
      }
    }

    const userText = getUserText(message)
    if (userText) {
      latestTaskLikeSignal = { index, text: userText }
    }

    const payload = getToolUseResultPayload(message)
    if (!payload) {
      continue
    }

    const signals = extractPhaseSignals(payload)
    if (signals.progress) {
      latestProgressSignalIndex = index
    }
  }

  if (latestTaskLikeSignal && latestTaskLikeSignal.index > latestProgressSignalIndex) {
    return latestTaskLikeSignal.text
  }

  return progressLine
}

function phaseSortIndex(phaseKey: AiWorkingPhaseKey): number {
  if (phaseKey === 'complete') {
    return PHASE_ORDER.length
  }

  return PHASE_ORDER.indexOf(phaseKey)
}

/**
 * @rr.id [PROPOSED] rr.nolme.section_accumulator
 * @rr.alias projectPhaseTimeline
 * @path.id ai-working-phase-timeline
 * @gwt.given normalized conversation history without explicit phase state
 * @gwt.when projectPhaseTimeline executes
 * @gwt.then derives ordered workflow phases and the active phase
 */
export function projectPhaseTimeline(messages: AiWorkingMessage[]): AiWorkingPhaseProjection {
  const workflowProjection = projectFromWorkflowTools(messages)
  if (workflowProjection) {
    return workflowProjection
  }

  const state = extractConversationState(messages)
  let phaseKeys: AiWorkingPhaseKey[] = extractAlgorithmPhaseKeys(messages)

  if (phaseKeys.length === 0 && !state.phaseKey) {
    const markerPhases = buildMarkerPhases(state.markers)
    if (markerPhases.length > 0) {
      return {
        phases: markerPhases,
        currentReviewLine: '',
        phaseKey: state.markers.completed ? 'complete' : state.markers.next ? 'plan' : null,
        progress: state.progress,
        source: 'marker',
      }
    }

    return {
      phases: [],
      currentReviewLine: '',
      phaseKey: null,
      progress: null,
      source: 'empty',
    }
  }

  if (state.phaseKey && state.phaseKey !== 'complete' && !phaseKeys.includes(state.phaseKey)) {
    phaseKeys = [...phaseKeys, state.phaseKey].sort(
      (left, right) => phaseSortIndex(left) - phaseSortIndex(right),
    )
  }

  if (phaseKeys.length === 0 && state.phaseKey) {
    phaseKeys = [state.phaseKey]
  }

  return {
    phases: buildPhases(phaseKeys, state),
    currentReviewLine: resolveCurrentReviewLine(messages, state.progress),
    phaseKey: state.phaseKey,
    progress: state.progress,
    source: state.phaseKey || state.progress ? 'prd' : 'algorithm',
  }
}
