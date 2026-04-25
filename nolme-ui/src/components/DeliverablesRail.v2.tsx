import packageIcon from '../assets/figma/deliverables-package.svg';
import fileTxtIcon from '../assets/figma/deliverables-file-txt.svg';
import spreadsheetIcon from '../assets/figma/deliverables-spreadsheet.svg';

export interface DeliverableItem {
  id: string;
  phase: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  subtitle: string;
  action?: 'download' | 'link';
}

export interface DeliverablesRailV2Props {
  items: DeliverableItem[];
}

type DeliverablePhase = DeliverableItem['phase'];

const PHASE_ORDER: DeliverablePhase[] = ['P1', 'P2', 'P3', 'P4'];

function phaseHeading(phase: DeliverablePhase): string {
  return `Phase ${phase.slice(1)} - Artifacts`;
}

function iconForDeliverable(item: DeliverableItem): string {
  const haystack = `${item.title} ${item.subtitle}`.toLowerCase();

  if (
    haystack.includes('spreadsheet')
    || haystack.includes('sheet')
    || haystack.includes('database')
    || haystack.includes('.csv')
    || haystack.includes('.xlsx')
    || haystack.includes('.xls')
  ) {
    return spreadsheetIcon;
  }

  return fileTxtIcon;
}

function groupByPhase(items: DeliverableItem[]): Array<{ phase: DeliverablePhase; items: DeliverableItem[] }> {
  const grouped = new Map<DeliverablePhase, DeliverableItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.phase);
    if (existing) {
      existing.push(item);
      continue;
    }
    grouped.set(item.phase, [item]);
  }

  return PHASE_ORDER.filter((phase) => grouped.has(phase)).map((phase) => ({
    phase,
    items: grouped.get(phase) ?? [],
  }));
}

export function DeliverablesRailV2({ items }: DeliverablesRailV2Props) {
  const groups = groupByPhase(items);

  return (
    <section
      data-testid="deliverables-rail-v2"
      className="mx-[-24px] flex w-[calc(100%+48px)] flex-1 flex-col gap-[16px] bg-white px-[24px] py-[24px]"
    >
      <header data-testid="deliverables-header" className="flex items-center gap-[8px]">
        <img
          alt=""
          aria-hidden="true"
          data-testid="deliverables-header-icon"
          src={packageIcon}
          className="h-[24px] w-[24px] shrink-0"
        />
        <h2 className="flex-1 font-['Satoshi:Bold',sans-serif] text-[22px] leading-[30px] tracking-[-0.5px] text-nolme-neutral-600">
          Deliverables
        </h2>
      </header>

      <div className="flex w-full flex-col overflow-clip">
        {groups.map((group) => (
          <section
            key={group.phase}
            data-testid={`deliverables-phase-${group.phase}`}
            className="flex w-full flex-col gap-[8px] justify-center overflow-clip py-[8px]"
          >
            <p
              data-testid={`deliverables-phase-label-${group.phase}`}
              className="font-['Satoshi:Medium',sans-serif] text-[12px] leading-[16px] tracking-[0.5px] text-nolme-neutral-900"
            >
              {phaseHeading(group.phase)}
            </p>

            <div data-testid={`deliverables-divider-${group.phase}`} className="flex h-px w-full items-center">
              <div className="h-px min-w-px flex-1 rounded-[999px] bg-[#e2e2ea]" />
            </div>

            <div className="flex w-full flex-col gap-[16px]">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  data-testid={`deliverable-row-${item.id}`}
                  className="flex w-full items-center gap-[10px]"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    data-testid={`deliverable-icon-${item.id}`}
                    src={iconForDeliverable(item)}
                    className="h-[32px] w-[32px] shrink-0"
                  />

                  <div className="flex min-w-0 flex-col items-start gap-[2px]">
                    <p
                      data-testid={`deliverable-title-${item.id}`}
                      className="font-['Satoshi:Medium',sans-serif] text-[16px] leading-[20px] tracking-[1px] text-nolme-neutral-900"
                    >
                      {item.title}
                    </p>
                    <p
                      data-testid={`deliverable-subtitle-${item.id}`}
                      className="font-['Satoshi:Medium',sans-serif] text-[11px] leading-[14px] tracking-[0.25px] text-nolme-neutral-500"
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
