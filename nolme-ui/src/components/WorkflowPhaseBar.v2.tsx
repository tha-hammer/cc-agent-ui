import { ChevronDown, Workflow } from 'lucide-react';
import { cn } from '../lib/cn';
import type { NolmePhase } from '../lib/types';

export interface WorkflowPhaseBarV2Props {
  phases: NolmePhase[];
  currentPhaseIndex?: number;
  currentReviewLine?: string;
  onEdit?: () => void;
}

function clampPhaseIndex(phases: NolmePhase[], currentPhaseIndex?: number): number {
  if (phases.length === 0) return 0;
  if (typeof currentPhaseIndex === 'number' && currentPhaseIndex >= 0 && currentPhaseIndex < phases.length) {
    return currentPhaseIndex;
  }

  const activeIndex = phases.findIndex((phase) => phase.status === 'active');
  return activeIndex >= 0 ? activeIndex : 0;
}

function phaseTabText(phase: NolmePhase): string {
  const label = phase.label.trim();
  const title = phase.title.trim();

  if (!label) return title;
  if (!title) return label;
  if (label.toLowerCase() === title.toLowerCase()) return label;
  if (label.includes(':') || label.toLowerCase().includes(title.toLowerCase())) return label;
  return `${label}: ${title}`;
}

function phaseStatusLabel(status: NolmePhase['status']): string {
  if (status === 'complete') return 'Done';
  if (status === 'active') return 'Active';
  return 'Waiting';
}

function phaseStatusClasses(status: NolmePhase['status']): string {
  if (status === 'complete') return 'bg-nolme-emerald-100 text-nolme-emerald-700';
  if (status === 'active') return 'bg-nolme-purple-100 text-nolme-purple-500';
  return 'bg-nolme-yellow-50 text-nolme-yellow-600';
}

function detailDescription(phase: NolmePhase, currentReviewLine: string): string {
  if (currentReviewLine.trim()) return currentReviewLine.trim();
  return `Continue the ${phase.title.toLowerCase()} workflow.`;
}

export function WorkflowPhaseBarV2({
  phases,
  currentPhaseIndex,
  currentReviewLine = '',
  onEdit,
}: WorkflowPhaseBarV2Props) {
  const selectedIndex = clampPhaseIndex(phases, currentPhaseIndex);
  const selectedPhase = phases[selectedIndex] ?? null;

  return (
    <section
      data-testid="workflow-phase-bar-v2"
      className="mx-[-24px] flex w-[calc(100%+48px)] flex-col gap-[24px] border-b border-nolme-border-input bg-white px-[24px] py-[24px]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px] text-nolme-neutral-600">
          <Workflow className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} />
          <h2 className="font-['Satoshi:Medium',sans-serif] text-[22px] leading-[30px] tracking-[-0.22px]">
            Phases
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="font-['Satoshi:Medium',sans-serif] text-[12px] leading-[18px] tracking-[0.24px] text-nolme-purple-500"
        >
          Edit
        </button>
      </div>

      <div className="flex flex-col gap-[16px]">
        <ol
          data-testid="workflow-phase-tabs-v2"
          className="flex w-[312px] items-start gap-[8px]"
        >
          {phases.map((phase, index) => (
            <li key={phase.id} className="shrink-0">
              <div
                data-testid={`workflow-phase-tab-${phase.id}`}
                aria-current={index === selectedIndex ? 'step' : undefined}
                className={cn(
                  'rounded-[999px] px-[10px] py-[4px] font-["Satoshi:Medium",sans-serif] text-[12px] leading-[16px] tracking-[0.24px]',
                  index === selectedIndex
                    ? 'bg-nolme-purple-200 text-nolme-purple-900'
                    : 'bg-nolme-neutral-200 text-nolme-neutral-600',
                )}
              >
                {phaseTabText(phase)}
              </div>
            </li>
          ))}
        </ol>

        {selectedPhase && (
          <article
            data-testid="workflow-phase-detail-v2"
            data-phase-status={selectedPhase.status}
            className="flex min-h-[116px] w-[312px] flex-col gap-[12px] rounded-[8px] border-[1.5px] border-nolme-purple-400 bg-nolme-purple-100 p-[16px]"
          >
            <div className="flex items-start justify-between gap-[12px]">
              <h3 className="font-['Satoshi:Medium',sans-serif] text-[16px] leading-[24px] text-nolme-neutral-900">
                {selectedPhase.title}
              </h3>
              <span
                data-testid="workflow-phase-status-v2"
                className={cn(
                  'shrink-0 rounded-[4px] px-[6px] py-[2px] font-["Satoshi:Medium",sans-serif] text-[12px] leading-[16px] tracking-[0.24px]',
                  phaseStatusClasses(selectedPhase.status),
                )}
              >
                {phaseStatusLabel(selectedPhase.status)}
              </span>
            </div>

            <div className="flex flex-col gap-[4px]">
              <p className="font-['Satoshi:Medium',sans-serif] text-[12px] leading-[18px] text-nolme-neutral-900">
                Task {selectedIndex + 1} of {phases.length}
              </p>
              <p className="font-['Satoshi:Regular',sans-serif] text-[12px] leading-[18px] text-nolme-neutral-600">
                {detailDescription(selectedPhase, currentReviewLine)}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-end gap-[4px] text-nolme-purple-500">
              <span className="font-['Satoshi:Medium',sans-serif] text-[12px] leading-[18px] tracking-[0.24px]">
                View tasks
              </span>
              <ChevronDown className="h-4 w-4" />
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
