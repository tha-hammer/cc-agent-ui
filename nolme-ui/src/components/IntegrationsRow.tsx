import { Plus } from 'lucide-react';

export type KnownIntegration = 'luma' | 'gmail' | 'google-sheets' | 'linear' | 'slack';

export interface IntegrationsRowProps {
  integrations: string[];
  onAdd?: () => void;
}

function integrationIcon(key: string) {
  switch (key) {
    case 'luma':
      return (
        <svg aria-label="Luma" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#FF6B00" />
          <path d="M12 7l-5 3v4l5 3 5-3v-4l-5-3z" fill="#fff" />
        </svg>
      );
    case 'gmail':
      return (
        <svg aria-label="Gmail" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#EA4335" />
          <path d="M2 6l10 7 10-7" stroke="#fff" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'google-sheets':
      return (
        <svg aria-label="Google Sheets" width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="0" y="0" width="18" height="22" rx="2" fill="#34A853" />
          <rect x="3" y="5" width="12" height="12" rx="1" fill="#fff" />
          <line x1="9" y1="5" x2="9" y2="17" stroke="#34A853" strokeWidth="1" />
          <line x1="3" y1="11" x2="15" y2="11" stroke="#34A853" strokeWidth="1" />
        </svg>
      );
    case 'linear':
      return (
        <svg aria-label="Linear" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#5E6AD2" />
          <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'slack':
      return (
        <svg aria-label="Slack" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="8" y="8" width="3" height="3" rx="0.5" fill="#E01E5A" />
          <rect x="13" y="8" width="3" height="3" rx="0.5" fill="#36C5F0" />
          <rect x="8" y="13" width="3" height="3" rx="0.5" fill="#2EB67D" />
          <rect x="13" y="13" width="3" height="3" rx="0.5" fill="#ECB22E" />
        </svg>
      );
    default:
      return (
        <span aria-label={key} className="text-[10px] font-semibold text-nolme-neutral-500">
          {key.slice(0, 2).toUpperCase()}
        </span>
      );
  }
}

/** Right-rail integrations icon strip. Extracted from NolmeDemo.tsx:883-900. */
export function IntegrationsRow({ integrations, onAdd }: IntegrationsRowProps) {
  return (
    <section className="rounded-[16px] border border-nolme-purple-300 bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nolme-neutral-900">Integrations</p>
        {onAdd && (
          <button aria-label="Add integration" onClick={onAdd} type="button">
            <Plus className="h-3.5 w-3.5 text-nolme-neutral-600" />
          </button>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        {integrations.map((key) => (
          <span className="inline-flex items-center justify-center" data-integration={key} key={key}>
            {integrationIcon(key)}
          </span>
        ))}
      </div>
    </section>
  );
}
