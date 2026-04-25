import type { NolmePhase } from '../../lib/types';
import type { ActiveSkillContext } from '../../../../src/hooks/useActiveSkillBroadcast';

const DEFAULT_PHASE_ACTIONS: Record<string, string[]> = {
  observe: ['Summarize context', 'Surface key unknowns', 'Define the first step'],
  think: ['Frame the problem', 'Compare options', 'Name the best approach'],
  plan: ['Draft the plan', 'Sequence the work', 'Call out dependencies'],
  build: ['Start implementation', 'Ship the next slice', 'Keep momentum'],
  execute: ['Run the workflow', 'Advance the task', 'Capture progress'],
  verify: ['Check the result', 'Review regressions', 'Validate the output'],
  learn: ['Capture takeaways', 'Document follow-up work', 'Save the insight'],
};

function clampUnique(values: Array<string | null | undefined>, limit = 3): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
    if (next.length >= limit) break;
  }
  return next;
}

function humanizeCommandName(commandName: string): string {
  return commandName
    .replace(/^\/+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function compactDescription(description: string): string {
  const firstClause = description.split(/[.;]/, 1)[0]?.trim() ?? '';
  if (!firstClause) return '';
  return firstClause.length > 54 ? `${firstClause.slice(0, 51).trim()}...` : firstClause;
}

function deriveSkillActions(activeSkill: ActiveSkillContext | null): string[] {
  if (!activeSkill) return [];

  const subject = activeSkill.argsText.trim();
  const description = typeof activeSkill.metadata?.description === 'string'
    ? compactDescription(activeSkill.metadata.description)
    : '';
  const label = humanizeCommandName(activeSkill.commandName);

  return clampUnique([
    subject ? `${label} for ${subject}` : `Continue with ${label}`,
    subject ? `Refine ${subject}` : description,
    description || `Use ${label} on this task`,
  ]);
}

function derivePhaseActions(phases: NolmePhase[], currentPhaseIndex: number): string[] {
  const currentPhase = phases[currentPhaseIndex] ?? phases.find((phase) => phase.status === 'active') ?? null;
  if (!currentPhase) {
    return DEFAULT_PHASE_ACTIONS.observe;
  }

  const candidates = [
    currentPhase.label,
    currentPhase.title,
    currentPhase.id,
  ]
    .map((value) => value.toLowerCase())
    .flatMap((value) => value.split(/[\s/_-]+/g));

  for (const candidate of candidates) {
    if (DEFAULT_PHASE_ACTIONS[candidate]) {
      return DEFAULT_PHASE_ACTIONS[candidate];
    }
  }

  return DEFAULT_PHASE_ACTIONS.observe;
}

export function projectSkillQuickActions(input: {
  activeSkill: ActiveSkillContext | null;
  explicitQuickActions: string[];
  phases: NolmePhase[];
  currentPhaseIndex: number;
}): string[] {
  const fromSkill = deriveSkillActions(input.activeSkill);
  if (fromSkill.length > 0) return fromSkill;

  const fromState = clampUnique(input.explicitQuickActions);
  if (fromState.length > 0) return fromState;

  return derivePhaseActions(input.phases, input.currentPhaseIndex);
}
