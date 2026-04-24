import { House, ListTodo, MessageCircle, Search, UserCog } from 'lucide-react';
import { cn } from '../lib/cn';

export type NavRailIcon = 'search' | 'home' | 'team' | 'messages' | 'tasks';

const ICONS: Record<NavRailIcon, typeof Search> = {
  search: Search,
  home: House,
  team: UserCog,
  messages: MessageCircle,
  tasks: ListTodo,
};

const ICON_ORDER: NavRailIcon[] = ['search', 'home', 'team', 'messages', 'tasks'];

export interface AgentNavRailProps {
  activeIcon?: NavRailIcon;
  avatarInitials?: string;
}

/**
 * 64px left rail — N logo, 5 nav icons, user avatar at the bottom.
 * Extracted from src/components/demo/view/NolmeDemo.tsx:608-635.
 */
export function AgentNavRail({ activeIcon = 'messages', avatarInitials = 'CM' }: AgentNavRailProps) {
  return (
    <nav
      aria-label="Nolme primary navigation"
      className="rounded-[18px] border border-nolme-purple-200 bg-white/90 p-2 shadow-[0_14px_36px_rgba(79,62,214,0.08)] backdrop-blur xl:flex xl:min-h-0 xl:flex-col"
    >
      <div className="flex h-full flex-row items-center gap-1.5 xl:min-h-0 xl:flex-col xl:items-center xl:justify-start">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-nolme-purple-300 bg-nolme-purple-100 text-nolme-purple-500">
          <span className="text-[20px] font-bold">N</span>
        </div>
        <div className="grid flex-1 grid-cols-5 gap-1.5 xl:mt-4 xl:flex-none xl:grid-cols-1 xl:content-start xl:gap-2">
          {ICON_ORDER.map((id) => {
            const Icon = ICONS[id];
            const isActive = id === activeIcon;
            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                aria-label={id}
                className={cn(
                  'flex h-9 w-full items-center justify-center rounded-[10px] border transition',
                  isActive
                    ? 'border-nolme-purple-400 bg-nolme-purple-100 text-nolme-purple-500'
                    : 'border-transparent bg-white text-nolme-neutral-600 hover:border-nolme-purple-200 hover:bg-nolme-purple-50',
                )}
                key={id}
                type="button"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nolme-purple-200 text-[11px] font-medium text-nolme-purple-500 xl:mt-auto">
          {avatarInitials}
        </div>
      </div>
    </nav>
  );
}
