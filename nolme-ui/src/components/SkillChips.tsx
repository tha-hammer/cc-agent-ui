import { Plus, Sparkles } from 'lucide-react';

export interface SkillChipsProps {
  skills: string[];
  onAdd?: () => void;
}

/** Right-rail skill chip row. Extracted from NolmeDemo.tsx:863-881. */
export function SkillChips({ skills, onAdd }: SkillChipsProps) {
  return (
    <section className="rounded-[16px] border border-nolme-purple-300 bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nolme-neutral-900">Skills</p>
        <Sparkles className="h-3.5 w-3.5 text-nolme-neutral-600" />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {skills.map((skill) => (
          <span
            className="rounded-full border border-[rgba(56,56,76,0.4)] px-2.5 py-1 text-[11px] font-medium text-[#38384c]"
            key={skill}
          >
            {skill}
          </span>
        ))}
        {onAdd && (
          <button
            aria-label="Add skill"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-nolme-purple-300 text-nolme-purple-400"
            onClick={onAdd}
            type="button"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </section>
  );
}
