import { cn } from '../lib/cn';

export interface ApprovalChipRowProps {
  options: string[];
  onSelect: (label: string) => void;
  disabled?: boolean;
  askQuestionLabel?: string;
  onAskQuestion?: () => void;
}

/**
 * Horizontal row of approval chips (Confirm / Revise / Ask) plus optional
 * amber "Ask question while working" pill. Props-only.
 * Extracted from NolmeDemo.tsx:779-795.
 */
export function ApprovalChipRow({
  options,
  onSelect,
  disabled = false,
  askQuestionLabel,
  onAskQuestion,
}: ApprovalChipRowProps) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          className={cn(
            'rounded-full bg-nolme-purple-200 px-3 py-1.5 text-[12px] font-medium text-nolme-purple-500 transition',
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d4ceff]',
          )}
          disabled={disabled}
          key={option}
          onClick={() => onSelect(option)}
          type="button"
        >
          {option}
        </button>
      ))}
      {askQuestionLabel && onAskQuestion && (
        <button
          className="rounded-full bg-nolme-amber-200 px-3 py-1.5 text-[11px] font-medium text-nolme-amber-500"
          onClick={onAskQuestion}
          type="button"
        >
          {askQuestionLabel}
        </button>
      )}
    </div>
  );
}
