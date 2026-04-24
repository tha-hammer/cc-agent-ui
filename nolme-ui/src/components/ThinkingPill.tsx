export interface ThinkingPillProps {
  label: string;
}

/**
 * Amber "AI thinking" pill with the N badge. Matches Figma node 95:1247.
 * Extracted from NolmeDemo.tsx:767-774.
 */
export function ThinkingPill({ label }: ThinkingPillProps) {
  return (
    <div
      aria-live="polite"
      className="inline-flex h-[42px] max-w-full items-center gap-2.5 rounded-full bg-nolme-amber-400 px-4 py-2 text-[13px] font-medium text-nolme-neutral-800"
      data-component="nolme-thinking-pill"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nolme-purple-500">
        <span className="text-[9px] font-bold text-white">N</span>
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
