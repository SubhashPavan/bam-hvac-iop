import type { ReactNode } from 'react';
import { Bell, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface AppTopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function AppTopbar({ title, subtitle, actions }: AppTopbarProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.name || 'User';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-navy-100 bg-white px-6 lg:px-8">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold leading-tight text-navy-900">{title}</h1>
        {subtitle && (
          <p className="text-[12.5px] leading-tight text-navy-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        {actions && <div className="mx-1 h-6 w-px bg-navy-100" />}

        <button
          type="button"
          className="relative rounded-lg p-2 text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500" />
        </button>

        <div className="flex items-center gap-2">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-navy-100"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-100">
              <UserIcon className="h-4 w-4" />
            </div>
          )}
          <span className="hidden text-sm font-medium text-navy-700 sm:block">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
