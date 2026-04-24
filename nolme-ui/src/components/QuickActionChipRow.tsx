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
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          className="rounded-full border border-[#d9d3ff] bg-white px-3 py-1.5 text-[12px] font-medium text-nolme-neutral-600 transition hover:border-nolme-purple-400 hover:text-nolme-purple-600 disabled:opacity-50"
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
