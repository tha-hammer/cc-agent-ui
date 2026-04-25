export interface UsageCardV2Props {
  percent: number;
}

export function UsageCardV2({ percent }: UsageCardV2Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      data-testid="usage-card-v2"
      className="flex w-full items-center gap-[8px]"
    >
      <div
        data-testid="usage-rail"
        className="flex h-[8px] min-w-0 flex-1 items-center overflow-hidden rounded-[999px] bg-[#f0f0f5]"
      >
        <div
          data-testid="usage-fill"
          className="h-[8px] rounded-[999px] bg-nolme-purple-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="shrink-0 font-[Satoshi:Medium] text-[11px] leading-[14px] tracking-[0.25px] text-nolme-neutral-500">
        {clamped}% used
      </p>
    </div>
  );
}
