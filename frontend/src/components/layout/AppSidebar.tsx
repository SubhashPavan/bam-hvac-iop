import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Brain,
  Boxes,
} from 'lucide-react';
import InsightSmartLogo from '../common/InsightSmartLogo';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** visible only for admin + manager */
  privileged?: boolean;
  /** visible only for admin */
  adminOnly?: boolean;
  /** match exactly (for root paths) */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', privileged: true },
  { to: '/', icon: FolderKanban, label: 'Workspaces', end: true },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', privileged: true },
  { to: '/accelerators', icon: Boxes, label: 'Accelerators', privileged: true },
  { to: '/model-registry', icon: Brain, label: 'Model Registry', adminOnly: true },
];

interface AppSidebarProps {
  /** Optional: highlight a nav item even if URL doesn't match exactly */
  activePath?: string;
  /** Initial collapsed state (useful on workspace view for max content area) */
  defaultCollapsed?: boolean;
}

export default function AppSidebar({ activePath, defaultCollapsed = false }: AppSidebarProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isPrivileged = useAuthStore((s) => s.isPrivileged);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.privileged && !isPrivileged) return false;
    return true;
  });

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      className={`${
        collapsed ? 'w-[72px]' : 'w-[250px]'
      } flex flex-col bg-navy-900 text-white transition-all duration-200 ease-in-out shrink-0`}
    >
      {/* Brand header */}
      <div
        className={`flex items-center border-b border-navy-700 h-16 ${
          collapsed ? 'justify-center px-2' : 'px-4'
        }`}
      >
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <InsightSmartLogo height={20} variant="light" />
          </div>
        ) : (
          <span className="text-[15px] font-extrabold tracking-tight text-accent-400">IS</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {visibleItems.map(({ to, icon: Icon, label, end }) => {
          const forcedActive = activePath && activePath === to;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const active = forcedActive || isActive;
                return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                    : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                }`;
              }}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User + logout + collapse */}
      <div className="space-y-2 p-3 border-t border-navy-800">
        {!collapsed && user && (
          <div className="px-2 pb-1 pt-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="flex items-center gap-1 truncate text-[11px] text-navy-400">
              {user.role === 'admin' && (
                <ShieldCheck className="h-3 w-3 text-accent-400" />
              )}
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-navy-400 transition-colors hover:bg-navy-800 hover:text-red-400"
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg border border-navy-700 p-2 text-navy-400 transition-colors hover:bg-navy-800 hover:text-white"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
