import type { NolmeAgentProfile } from '../lib/types';

export interface AgentProfileCardProps {
  profile: NolmeAgentProfile;
  onOpenJobDescription?: () => void;
  onOpenGuidelines?: () => void;
}

/**
 * Right-rail Aria card: avatar, name + role, usage ring, JD + Guidelines pills.
 * Extracted from NolmeDemo.tsx:835-861.
 */
export function AgentProfileCard({ profile, onOpenJobDescription, onOpenGuidelines }: AgentProfileCardProps) {
  const avatarUrl = profile.avatarUrl ?? 'https://i.pravatar.cc/150?img=32';
  return (
    <section className="rounded-[16px] border border-nolme-purple-300 bg-white p-3 shadow-[0_8px_20px_rgba(79,62,214,0.05)]">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0">
          <img
            alt={profile.name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-nolme-emerald-500"
            src={avatarUrl}
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-nolme-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-nolme-neutral-800">{profile.name}</p>
          <p className="text-[13px] text-nolme-neutral-600">{profile.role}</p>
        </div>
        {typeof profile.usageValue === 'number' && (
          <div
            aria-label={`Usage ${profile.usageValue}%`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-nolme-emerald-500 bg-nolme-emerald-500/10"
          >
            <span className="text-[10px] font-semibold text-nolme-emerald-500">Usage</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-full border-[1.5px] border-[#6550f0] px-3 py-1.5 text-[12px] font-medium text-[#6550f0]"
          onClick={onOpenJobDescription}
          type="button"
        >
          Job Description
        </button>
        <button
          className="rounded-full border-[1.5px] border-[#6550f0] px-3 py-1.5 text-[12px] font-medium text-[#6550f0]"
          onClick={onOpenGuidelines}
          type="button"
        >
          Guidelines
        </button>
      </div>
    </section>
  );
}
