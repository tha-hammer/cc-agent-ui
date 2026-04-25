import { Star } from 'lucide-react';

export interface OutputCardV2Props {
  title: string;
  subtitle: string;
  description?: string;
  rating?: number;
}

export function OutputCardV2({ title, subtitle, description, rating }: OutputCardV2Props) {
  return (
    <article data-testid="output-card-v2" className="bg-white rounded-[8px] p-[10px]">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-nolme-neutral-900">{title}</h3>
      <p className="mt-1 text-[13px] text-nolme-neutral-600">{subtitle}</p>
      {description && <p className="mt-1 text-[12px] text-nolme-neutral-500">{description}</p>}
      {typeof rating === 'number' && (
        <div className="mt-2 flex items-center gap-2 text-[14px] text-nolme-neutral-800">
          <span>{rating.toFixed(1)}</span>
          <div className="flex items-center gap-1 text-[#f59e0b]" aria-label={`rating ${rating}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star className="h-[18px] w-[18px] fill-current" key={i} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
