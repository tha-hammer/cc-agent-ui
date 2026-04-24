import { ChevronDown, Download, Link2 } from 'lucide-react';
import { cn } from '../lib/cn';
import type { NolmeResource } from '../lib/types';

export interface ResourcesRailProps {
  resources: NolmeResource[];
  collapsible?: boolean;
}

/** Right-rail P1/P2/P3/P4 resource cards. Extracted from NolmeDemo.tsx:902-942. */
export function ResourcesRail({ resources, collapsible = false }: ResourcesRailProps) {
  return (
    <section className="rounded-[16px] border border-nolme-purple-300 bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nolme-neutral-900">Resources</p>
        {collapsible && <ChevronDown className="h-3.5 w-3.5 text-nolme-neutral-600" />}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {resources.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#d9d3ff] bg-[#faf9ff] px-4 py-5 text-[14px] leading-[1.6] text-nolme-neutral-500">
            Resources appear here as the workflow produces artifacts.
          </div>
        ) : (
          resources.map((resource) => (
            <div
              className="flex items-start gap-3 rounded-[14px] border border-[#efecff] px-3 py-3"
              key={resource.id}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-[4px] text-[10px] font-medium text-white',
                  resource.tone === 'emerald' && 'bg-nolme-emerald-500',
                  resource.tone === 'iris' && 'bg-nolme-purple-400',
                  resource.tone === 'gold' && 'bg-nolme-amber-500',
                )}
              >
                {resource.badge}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-nolme-neutral-900">{resource.title}</p>
                <p className="text-[10px] text-nolme-neutral-500">{resource.subtitle}</p>
              </div>
              {resource.action === 'download' ? (
                <Download aria-label="download" className="h-4 w-4 text-nolme-neutral-600" />
              ) : (
                <Link2 aria-label="link" className="h-4 w-4 text-nolme-neutral-600" />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
