import type { ActiveSkillContext } from '../../../../src/hooks/useActiveSkillBroadcast';
import type {
  NolmeAgentStateLike,
  NolmePhase,
  NolmeResource,
  NolmeSessionBinding,
} from '../types';
import { DEFAULT_NOLME_AGENT_STATE } from '../types';
import { normalizeNolmeState } from './normalizeNolmeState';
import { projectAssistantQuestion } from './projectAssistantQuestion';
import { projectDeliverables } from './projectDeliverables';
import { projectPhaseTimeline } from './projectPhaseTimeline';
import type {
  AiWorkingMessage,
  AiWorkingProjection,
  AiWorkingProjectionInput,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeMessage(raw: unknown, index: number): AiWorkingMessage | null {
  if (!isRecord(raw)) return null;

  const kind = asString(raw.kind);
  if (!kind) return null;

  const toolResult = isRecord(raw.toolResult)
    ? {
        toolUseResult: isRecord(raw.toolResult.toolUseResult)
          ? raw.toolResult.toolUseResult
          : undefined,
      }
    : undefined;

  return {
    id: asString(raw.id),
    timestamp: asString(raw.timestamp),
    kind,
    role: asString(raw.role),
    content: asString(raw.content),
    text: asString(raw.text),
    toolName: asString(raw.toolName),
    toolId: asString(raw.toolId),
    toolInput: isRecord(raw.toolInput)
      ? raw.toolInput
      : isRecord(raw.input)
        ? raw.input
        : undefined,
    toolUseResult: isRecord(raw.toolUseResult) ? raw.toolUseResult : undefined,
    toolResult,
  };
}

function normalizeMessages(rawMessages: unknown): AiWorkingMessage[] {
  return Array.isArray(rawMessages)
    ? rawMessages
        .map((message, index) => normalizeMessage(message, index))
        .filter((message): message is AiWorkingMessage => Boolean(message))
    : [];
}

function deriveCurrentPhaseIndex(phases: NolmePhase[]): number {
  const activeIndex = phases.findIndex((phase) => phase.status === 'active');
  if (activeIndex >= 0) {
    return activeIndex;
  }

  const firstIncompleteIndex = phases.findIndex((phase) => phase.status !== 'complete');
  if (firstIncompleteIndex >= 0) {
    return firstIncompleteIndex;
  }

  return phases.length > 0 ? phases.length - 1 : 0;
}

function projectQuickActions(state: NolmeAgentStateLike): string[] {
  return Array.isArray(state.quickActions)
    ? state.quickActions
    : DEFAULT_NOLME_AGENT_STATE.quickActions;
}

function resolveActiveSkill(
  binding: NolmeSessionBinding | null | undefined,
  activeSkill: ActiveSkillContext | null | undefined,
): ActiveSkillContext | null {
  if (!activeSkill) {
    return null;
  }

  if (!binding) {
    return activeSkill;
  }

  return (
    activeSkill.provider === binding.provider
    && activeSkill.sessionId === binding.sessionId
    && activeSkill.projectPath === binding.projectPath
  )
    ? activeSkill
    : null;
}

/**
 * @rr.id [PROPOSED] rr.nolme.ai_working_projection
 * @rr.alias projectAiWorkingProjection
 * @path.id ai-working-projection
 * @gwt.given hydrated messages, persisted state, token budget, active skill
 * @gwt.when projectAiWorkingProjection executes
 * @gwt.then returns a deterministic ai-working view model
 */
export function projectAiWorkingProjection(input: AiWorkingProjectionInput): AiWorkingProjection {
  const normalizedState = normalizeNolmeState(input.state);
  const messages = normalizeMessages(input.messages);
  const phaseProjection = projectPhaseTimeline(messages);
  const fallbackDeliverables = projectDeliverables(messages);
  const questionCard = projectAssistantQuestion(messages);

  const phases = normalizedState.explicit.phases
    ? normalizedState.state.phases
    : phaseProjection.phases;
  const deliverables = normalizedState.explicit.resources
    ? (normalizedState.state.resources as NolmeResource[])
    : fallbackDeliverables;
  const currentReviewLine = normalizedState.explicit.phases
    ? normalizedState.state.currentReviewLine
    : phaseProjection.currentReviewLine;
  const currentPhaseIndex = normalizedState.explicit.phases
    ? normalizedState.state.currentPhaseIndex
    : deriveCurrentPhaseIndex(phases);

  const state: NolmeAgentStateLike = {
    ...normalizedState.state,
    phases,
    resources: deliverables,
    currentReviewLine,
    currentPhaseIndex,
  };

  return {
    state,
    messages,
    activeSkill: resolveActiveSkill(input.binding, input.activeSkill),
    phases,
    deliverables,
    questionCard,
    quickActions: projectQuickActions(state),
    explicit: normalizedState.explicit,
    empty: {
      messages: messages.length === 0,
      phases: phases.length === 0,
      resources: deliverables.length === 0,
      quickActions: state.quickActions.length === 0,
    },
  };
}
