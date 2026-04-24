import { Star } from 'lucide-react';
import { cn } from '../lib/cn';

export type OutputCardTone = 'white' | 'lavender' | 'amber' | 'mint';

export interface OutputCardProps {
  title: string;
  subtitle: string;
  description?: string;
  tone?: OutputCardTone;
  rating?: number;
}

function toneClasses(tone: OutputCardTone): string {
  switch (tone) {
    case 'lavender':
      return 'border-[#cfc6ff] bg-[#f3f0ff]';
    case 'amber':
      return 'border-nolme-amber-300 bg-nolme-amber-100';
    case 'mint':
      return 'border-[#bcebd7] bg-[#effcf5]';
    case 'white':
    default:
      return 'border-white/80 bg-white';
  }
}

/**
 * In-stream output card (venues, docs, etc.). Props-only.
 * Extracted from NolmeDemo.tsx:733-756.
 */
export function OutputCard({ title, subtitle, description, tone = 'white', rating }: OutputCardProps) {
  return (
    <article
      className={cn(
        'h-auto min-h-[98px] w-[330px] shrink-0 rounded-[10px] border p-[10px] shadow-[0_4px_12px_rgba(79,62,214,0.04)]',
        toneClasses(tone),
      )}
    >
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-nolme-neutral-900">{title}</h3>
      <p className="mt-1 text-[13px] text-nolme-neutral-600">{subtitle}</p>
      {description && <p className="mt-1 text-[12px] text-nolme-neutral-500">{description}</p>}
      {typeof rating === 'number' && (
        <div className="mt-2 flex items-center gap-2 text-[14px] text-nolme-neutral-800">
          <span>{rating.toFixed(1)}</span>
          <div className="flex items-center gap-1 text-[#f59e0b]" aria-label={`rating ${rating}`}>
            {Array.from({ length: 5 }).map((_, starIndex) => (
              <Star className="h-[18px] w-[18px] fill-current" key={starIndex} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
