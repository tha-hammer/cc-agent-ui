import { normalizeActiveSkillContext } from '../../../../src/hooks/useActiveSkillBroadcast';
import {
  DEFAULT_NOLME_AGENT_STATE,
  type NolmeAgentProfile,
  type NolmeAgentStateLike,
  type NolmePhase,
  type NolmeResource,
  type NolmeTaskNotification,
} from '../types';

const RESOURCE_TONE_FROM_BADGE: Record<NolmeResource['badge'], NolmeResource['tone']> = {
  P1: 'emerald',
  P2: 'iris',
  P3: 'gold',
  P4: 'gold',
};

export interface NormalizeNolmeStateResult {
  state: NolmeAgentStateLike;
  explicit: {
    phases: boolean;
    resources: boolean;
    quickActions: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function humanizeId(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizePhase(raw: unknown): NolmePhase | null {
  if (!isRecord(raw)) return null;

  const id = asNonEmptyString(raw.id);
  if (!id) return null;

  const fallback = humanizeId(id);
  const status = asNonEmptyString(raw.status);

  return {
    id,
    label: asNonEmptyString(raw.label) ?? fallback,
    title: asNonEmptyString(raw.title) ?? fallback,
    status:
      status === 'active' || status === 'complete' || status === 'idle'
        ? status
        : 'idle',
  };
}

function normalizeResource(raw: unknown): NolmeResource | null {
  if (!isRecord(raw)) return null;

  const title = asNonEmptyString(raw.title);
  const subtitle = asNonEmptyString(raw.subtitle);
  if (!title || !subtitle) return null;

  const badge = asNonEmptyString(raw.badge);
  const normalizedBadge =
    badge === 'P1' || badge === 'P2' || badge === 'P3' || badge === 'P4' ? badge : 'P1';
  const action = asNonEmptyString(raw.action);
  const tone = asNonEmptyString(raw.tone);

  return {
    id: asNonEmptyString(raw.id) ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    badge: normalizedBadge,
    title,
    subtitle,
    tone:
      tone === 'emerald' || tone === 'iris' || tone === 'gold'
        ? tone
        : RESOURCE_TONE_FROM_BADGE[normalizedBadge],
    action: action === 'link' || action === 'download' ? action : 'download',
    url: asNonEmptyString(raw.url) ?? undefined,
  };
}

function normalizeProfile(raw: unknown): NolmeAgentProfile | null {
  if (!isRecord(raw)) return null;

  const name = asNonEmptyString(raw.name);
  const role = asNonEmptyString(raw.role);
  if (!name || !role) return null;

  const normalizeStrings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((entry) => asNonEmptyString(entry))
          .filter((entry): entry is string => Boolean(entry))
      : [];

  const usageValue = asFiniteNumber(raw.usageValue);

  return {
    name,
    role,
    avatarUrl: asNonEmptyString(raw.avatarUrl) ?? undefined,
    skills: normalizeStrings(raw.skills),
    integrations: normalizeStrings(raw.integrations),
    ...(usageValue === null ? {} : { usageValue }),
  };
}

function normalizeTaskNotification(raw: unknown): NolmeTaskNotification | null {
  if (!isRecord(raw)) return null;

  const status = asNonEmptyString(raw.status);
  const summary = asNonEmptyString(raw.summary);
  const ts = asFiniteNumber(raw.ts);

  if (!status || !summary || ts === null) return null;
  return { status, summary, ts };
}

function deriveCurrentPhaseIndex(phases: NolmePhase[], rawIndex: unknown): number {
  const explicitIndex = asFiniteNumber(rawIndex);
  if (
    explicitIndex !== null
    && Number.isInteger(explicitIndex)
    && explicitIndex >= 0
    && explicitIndex < phases.length
  ) {
    return explicitIndex;
  }

  const activeIndex = phases.findIndex((phase) => phase.status === 'active');
  return activeIndex >= 0 ? activeIndex : 0;
}

function cloneTokenBudget(raw: unknown): unknown {
  return isRecord(raw) ? { ...raw } : null;
}

/**
 * @rr.id [PROPOSED] rr.nolme.nolme_state_sidecar
 * @rr.alias normalizeNolmeState
 * @path.id ai-working-nolme-state-validation
 * @gwt.given persisted or live Nolme state
 * @gwt.when normalizeNolmeState executes
 * @gwt.then invalid fields fall back to defaults and valid ai-working slices are preserved
 */
export function normalizeNolmeState(raw: unknown): NormalizeNolmeStateResult {
  if (!isRecord(raw)) {
    return {
      state: { ...DEFAULT_NOLME_AGENT_STATE },
      explicit: { phases: false, resources: false, quickActions: false },
    };
  }

  const phases = Array.isArray(raw.phases)
    ? raw.phases.map((phase) => normalizePhase(phase)).filter((phase): phase is NolmePhase => Boolean(phase))
    : [];
  const resources = Array.isArray(raw.resources)
    ? raw.resources
        .map((resource) => normalizeResource(resource))
        .filter((resource): resource is NolmeResource => Boolean(resource))
    : [];
  const quickActions = Array.isArray(raw.quickActions)
    ? raw.quickActions
        .map((action) => asNonEmptyString(action))
        .filter((action): action is string => Boolean(action))
    : [];
  const taskNotifications = Array.isArray(raw.taskNotifications)
    ? raw.taskNotifications
        .map((notification) => normalizeTaskNotification(notification))
        .filter((notification): notification is NolmeTaskNotification => Boolean(notification))
    : [];

  const next: NolmeAgentStateLike = {
    ...raw,
    schemaVersion: 1,
    phases,
    currentPhaseIndex: deriveCurrentPhaseIndex(phases, raw.currentPhaseIndex),
    currentReviewLine: asNonEmptyString(raw.currentReviewLine) ?? '',
    resources,
    profile: normalizeProfile(raw.profile),
    quickActions,
    taskNotifications,
  };

  if ('tokenBudget' in raw) {
    next.tokenBudget = cloneTokenBudget(raw.tokenBudget);
  }

  if ('activeSkill' in raw) {
    next.activeSkill = normalizeActiveSkillContext(raw.activeSkill);
  }

  return {
    state: next,
    explicit: {
      phases: Array.isArray(raw.phases) && raw.phases.length > 0,
      resources: Array.isArray(raw.resources) && raw.resources.length > 0,
      quickActions: Array.isArray(raw.quickActions),
    },
  };
}
