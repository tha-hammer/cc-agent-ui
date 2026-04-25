import type { NolmeAgentProfile } from '../lib/types';

export interface AgentProfileCardV2Props {
  profile: NolmeAgentProfile;
  onOpenJobDescription?: () => void;
  onOpenGuidelines?: () => void;
}

export function AgentProfileCardV2({
  profile,
}: AgentProfileCardV2Props) {
  const avatarUrl = profile.avatarUrl ?? 'https://i.pravatar.cc/150?img=32';
  const label = profile.role.trim()
    ? `${profile.name} • ${profile.role}`
    : profile.name;

  return (
    <div
      data-testid="agent-profile-card-v2"
      className="flex items-center gap-[6px]"
    >
      <img
        alt={profile.name}
        src={avatarUrl}
        className="h-[24px] w-[24px] shrink-0 rounded-[12px] object-cover"
      />
      <p className="min-w-0 truncate font-[Satoshi:Regular] text-[12px] text-nolme-neutral-500">
        {label}
      </p>
    </div>
  );
}
