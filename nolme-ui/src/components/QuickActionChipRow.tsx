export interface QuickActionChipRowProps {
  options: string[];
  onSelect: (label: string) => void;
  disabled?: boolean;
}

/**
 * White-outline quick-action chips shown below the approval row.
 * Extracted from NolmeDemo.tsx:798-807.
 */
export function QuickActionChipRow({ options, onSelect, disabled = false }: QuickActionChipRowProps) {
  if (options.length === 0) return null;
  return (
    <div data-testid="quick-action-chip-row" className="flex flex-wrap justify-end gap-[6px]">
      {options.map((option) => (
        <button
          className="rounded-[999px] bg-nolme-purple-100 px-[10px] py-[4px] font-[Satoshi:Medium] text-[12px] leading-[16px] tracking-[0.5px] text-nolme-purple-900 transition disabled:opacity-50"
          disabled={disabled}
          key={option}
          onClick={() => onSelect(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
