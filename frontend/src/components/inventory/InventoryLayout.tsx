import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Inbox, CheckSquare, ShieldAlert, Sparkles, Wallet, Factory, LineChart, Layers, MessageSquare,
  Settings, Users, Database, Search, RefreshCw, Bell, Sun, Moon, LogOut,
  ShieldCheck, Lock, type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useInvAccess } from '../../data/inventoryAccess';

const BASE = '/accelerator/inventory-optimization';

interface NavItem { to: string; icon: LucideIcon; label: string; hint?: string }
interface NavGroup { title: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { title: 'Home', items: [
    { to: 'home', icon: Home, label: 'My Plants' },
  ]},
  { title: 'Work', items: [
    { to: 'review', icon: Inbox, label: 'Review', hint: 'Triage AI recommendations' },
    { to: 'approvals', icon: CheckSquare, label: 'Approvals', hint: 'Decisions awaiting you' },
    { to: 'risk', icon: ShieldAlert, label: 'Risk' },
  ]},
  { title: 'Analyze', items: [
    { to: 'forecast', icon: LineChart, label: 'Forecast' },
    { to: 'savings', icon: Wallet, label: 'Savings' },
    { to: 'opportunity', icon: Sparkles, label: 'Opportunity Finder' },
    { to: 'plants', icon: Factory, label: 'Plant Detail' },
    { to: 'impact', icon: Wallet, label: 'Impact' },
    { to: 'digital-twin', icon: Layers, label: 'Digital Twin' },
  ]},
  { title: 'Assist', items: [
    { to: 'ask', icon: MessageSquare, label: 'Ask' },
  ]},
  { title: 'Admin', items: [
    { to: 'settings', icon: Settings, label: 'Settings' },
    { to: 'users', icon: Users, label: 'User Management' },
    { to: 'data-sources', icon: Database, label: 'Data Sources' },
  ]},
];

export default function InventoryLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const access = useInvAccess();
  const loc = useLocation();
  const seg = loc.pathname.replace(`${BASE}/`, '').split('/')[0] || 'review';
  const allowed = seg === 'review' || access.navKeys.has(seg);

  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem('inv-theme') !== 'light'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('inv-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ } }, [dark]);

  const initials = (user?.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="flex h-screen overflow-hidden bg-navy-50 font-sans text-navy-900 dark:bg-[#080d1a] dark:text-slate-100">
        {/* Sidebar */}
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-navy-100 bg-white dark:border-slate-800/70 dark:bg-[#0b1222]">
          <div className="flex items-center gap-2.5 border-b border-navy-100 px-4 py-3.5 dark:border-slate-800/70">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-[12px] font-bold text-white shadow-lg shadow-accent-500/20">IS</div>
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold">Inventory Optimization</div>
              <div className="text-[10.5px] text-navy-400 dark:text-slate-500">Inventory Optimization</div>
            </div>
          </div>

          <nav className="custom-scrollbar flex-1 overflow-y-auto px-2.5 py-3">
            {NAV.map((g) => {
              const items = g.items.filter((it) => access.navKeys.has(it.to));
              if (!items.length) return null;
              return (
                <div key={g.title} className="mb-3">
                  <div className="px-2 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-navy-400 dark:text-slate-600">{g.title}</div>
                  {items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <NavLink key={it.to} to={`${BASE}/${it.to}`}
                        className={({ isActive }) =>
                          `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors ${
                            isActive ? 'bg-accent-500/10 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                                     : 'text-navy-600 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Persona footer */}
          <div className="flex items-center gap-2.5 border-t border-navy-100 px-3 py-3 dark:border-slate-800/70">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-[11px] font-semibold text-accent-700 dark:bg-slate-800 dark:text-slate-300">{initials}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-medium">{user?.name || 'User'}</div>
              <div className="truncate text-[10px] text-navy-400 dark:text-slate-500">{access.persona}</div>
            </div>
            <button onClick={() => setDark((v) => !v)} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => navigate('/accelerators')} className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Exit"><LogOut className="h-4 w-4" /></button>
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-navy-100 bg-white/60 px-5 backdrop-blur dark:border-slate-800/70 dark:bg-[#0b1222]/60">
            <div className="flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-[12px] text-navy-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
              <Search className="h-3.5 w-3.5" /><span>Search materials, plants…</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-navy-200 bg-navy-50 px-2.5 py-1 text-[10.5px] font-medium text-navy-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <ShieldCheck className="h-3 w-3" /> {access.scope}
            </span>
            <button className="rounded-lg p-2 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
            <button className="relative rounded-lg p-2 text-navy-400 hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger-500 text-[8px] font-bold text-white">3</span>
            </button>
          </header>

          <main className="custom-scrollbar flex-1 overflow-y-auto">
            {allowed ? <Outlet /> : <Restricted persona={access.persona} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Restricted({ persona }: { persona: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400"><Lock className="h-6 w-6" /></div>
      <div>
        <h1 className="text-[17px] font-semibold">Not available for your role</h1>
        <p className="mt-1 text-[13px] text-navy-500 dark:text-slate-500">This area isn't part of the <span className="font-medium">{persona}</span> workspace. Ask an admin if you need access.</p>
      </div>
    </div>
  );
}
