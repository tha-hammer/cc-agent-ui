export type QuickActionTone = 'primary' | 'amber';

export interface QuickActionChipV2 {
  label: string;
  tone: QuickActionTone;
}

export interface QuickActionChipRowV2Props {
  actions: QuickActionChipV2[];
  onSelect?: (label: string) => void;
}

const PRIMARY_CLASSES =
  'bg-nolme-purple-200 text-nolme-purple-500 font-[Satoshi:Medium] text-[14px] leading-[18px]';
const AMBER_CLASSES =
  'bg-nolme-amber-200 text-nolme-amber-500 font-[Satoshi:Medium] text-[12px] leading-[16px]';

export function QuickActionChipRowV2({ actions, onSelect }: QuickActionChipRowV2Props) {
  if (!actions.length) return null;
  return (
    <div data-testid="quick-action-chip-row-v2" className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onSelect?.(a.label)}
          data-tone={a.tone}
          className={`rounded-[999px] px-[10px] py-[8px] ${
            a.tone === 'amber' ? AMBER_CLASSES : PRIMARY_CLASSES
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
