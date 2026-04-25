export interface ThinkingPillV2Props {
  label: string;
}

export function ThinkingPillV2({ label }: ThinkingPillV2Props) {
  return (
    <div
      aria-live="polite"
      data-testid="thinking-pill-v2"
      data-component="nolme-thinking-pill-v2"
      className="inline-flex items-center gap-2.5 rounded-[100px] bg-nolme-amber-400 px-[16px] py-[8px] w-fit"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nolme-purple-500">
        <span className="text-[9px] font-bold text-white">N</span>
      </span>
      <span
        data-testid="thinking-pill-v2-label"
        className="font-[Satoshi:Medium] text-[16px] leading-[26px] text-nolme-neutral-800"
      >
        {label}
      </span>
    </div>
  );
}
