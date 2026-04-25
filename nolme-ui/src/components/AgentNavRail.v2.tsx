import { House, ListTodo, MessageCircle, Search, UserCog } from 'lucide-react';
import { cn } from '../lib/cn';

export type NavRailV2Icon = 'search' | 'home' | 'team' | 'messages' | 'tasks';

const ICONS: Record<NavRailV2Icon, typeof Search> = {
  search: Search,
  home: House,
  team: UserCog,
  messages: MessageCircle,
  tasks: ListTodo,
};

const ICON_ORDER: NavRailV2Icon[] = ['search', 'home', 'team', 'messages', 'tasks'];

export interface AgentNavRailV2Props {
  activeIcon?: NavRailV2Icon;
  avatarInitials?: string;
}

export function AgentNavRailV2({ activeIcon = 'messages', avatarInitials = 'CM' }: AgentNavRailV2Props) {
  return (
    <nav
      aria-label="Nolme primary navigation"
      data-testid="agent-nav-rail-v2"
      className="flex h-full flex-col items-center justify-between border-y border-nolme-purple-300 bg-white p-2"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-nolme-purple-300 bg-nolme-purple-100 text-nolme-purple-500">
        <span className="text-[20px] font-bold">N</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-2 pt-4">
        {ICON_ORDER.map((id) => {
          const Icon = ICONS[id];
          const isActive = id === activeIcon;
          return (
            <button
              key={id}
              aria-current={isActive ? 'page' : undefined}
              aria-label={id}
              type="button"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[10px] border transition',
                isActive
                  ? 'border-nolme-purple-400 bg-nolme-purple-100 text-nolme-purple-500'
                  : 'border-transparent bg-white text-nolme-neutral-600 hover:border-nolme-purple-200 hover:bg-nolme-purple-50',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nolme-purple-200 text-[11px] font-medium text-nolme-purple-500">
        {avatarInitials}
      </div>
    </nav>
  );
}
