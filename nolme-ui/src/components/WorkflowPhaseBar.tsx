import { Check } from 'lucide-react';
import { cn } from '../lib/cn';
import type { NolmePhase } from '../lib/types';

export interface WorkflowPhaseBarProps {
  phases: NolmePhase[];
  currentReviewLine?: string;
  onEdit?: () => void;
}

/**
 * Top workflow phase bar with idle/active/complete states per phase card.
 * Extracted from NolmeDemo.tsx:640-699.
 */
export function WorkflowPhaseBar({ phases, currentReviewLine = '', onEdit }: WorkflowPhaseBarProps) {
  return (
    <section className="shrink-0 rounded-[18px] border border-white/80 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(79,62,214,0.06)] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-nolme-neutral-900">Workflow Phases:</span>
          {currentReviewLine && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-nolme-neutral-800">
              <strong className="font-medium">Reviewing</strong>
              {currentReviewLine}
              <span className="h-2 w-2 rounded-full bg-nolme-amber-400" aria-hidden="true" />
            </span>
          )}
        </div>
        {onEdit && (
          <button className="text-[13px] font-medium text-nolme-purple-600 hover:underline" onClick={onEdit} type="button">
            Edit
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-6">
        {phases.map((phase) => (
          <div
            aria-current={phase.status === 'active' ? 'step' : undefined}
            className={cn(
              'h-[69px] w-[200px] shrink-0 rounded-[10px] border px-2 py-[9.5px] transition',
              phase.status === 'active' && 'border-nolme-purple-400 bg-nolme-purple-100',
              phase.status === 'complete' && 'border-nolme-purple-200 bg-nolme-purple-50',
              phase.status === 'idle' && 'border-nolme-neutral-200 bg-nolme-neutral-100',
            )}
            data-phase-status={phase.status}
            key={phase.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.08em]',
                  phase.status === 'active' ? 'text-nolme-purple-600' : 'text-nolme-neutral-600',
                )}
              >
                {phase.label}
              </span>
              {phase.status === 'active' && (
                <span className="rounded-full border border-nolme-purple-400 px-2 py-0.5 text-[10px] font-semibold text-nolme-purple-500">
                  Active
                </span>
              )}
              {phase.status === 'complete' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-nolme-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-nolme-emerald-700">
                  <Check className="h-3 w-3" />
                  Done
                </span>
              )}
            </div>
            <p
              className={cn(
                'mt-1 text-[13px] leading-[1.3] font-medium',
                phase.status === 'idle' ? 'text-nolme-neutral-500' : 'text-nolme-neutral-800',
              )}
            >
              {phase.title}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
