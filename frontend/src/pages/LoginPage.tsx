import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shield, Crown, Briefcase, User, ArrowRight } from 'lucide-react';
import InsightSmartLogo from '../components/common/InsightSmartLogo';
import { fetchDemoUsers, useAuthStore, type DemoUser } from '../store/authStore';

/**
 * Demo login page. No SSO — pick a persona, get a JWT.
 *
 * The roster is seeded in `backend/scripts/seed_demo_users.py`:
 *   1 admin · 2 managers · 4 users (2 per manager).
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { loginAsDemo, isAuthenticated, user } = useAuthStore();
  const [demoUsers, setDemoUsers] = useState<DemoUser[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // If already authed, bounce
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.status === 'pending' || user.status === 'suspended' ? '/pending' : '/', {
        replace: true,
      });
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch the demo roster
  useEffect(() => {
    fetchDemoUsers()
      .then(setDemoUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'));
  }, []);

  const handlePick = async (u: DemoUser) => {
    setLoadingId(u.id);
    setError('');
    try {
      await loginAsDemo(u.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setLoadingId(null);
    }
  };

  // Group users by role for the layout: admin → managers → users (under
  // their manager when possible).
  const grouped = useMemo(() => {
    if (!demoUsers) return null;
    const admin = demoUsers.find((u) => u.role === 'admin') || null;
    const managers = demoUsers.filter((u) => u.role === 'manager');
    const usersByMgr = new Map<string, DemoUser[]>();
    for (const u of demoUsers.filter((u) => u.role === 'user')) {
      const key = u.manager_id || '';
      if (!usersByMgr.has(key)) usersByMgr.set(key, []);
      usersByMgr.get(key)!.push(u);
    }
    return { admin, managers, usersByMgr };
  }, [demoUsers]);

  return (
    <div className="flex min-h-screen bg-navy-50">
      {/* Left brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full bg-accent-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-32 bottom-0 h-[340px] w-[340px] rounded-full bg-accent-700/20 blur-3xl"
        />

        <div className="relative z-10">
          <InsightSmartLogo height={28} variant="light" />
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-300">
            Demo environment · DataLens
          </span>
          <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-tight">
            Agentic insight,
            <br />
            <span className="text-accent-400">grounded in your data.</span>
          </h1>
          <p className="mt-5 text-[14.5px] leading-relaxed text-navy-300">
            DataLens is powered by Agentic AI that feeds on your
            data context to produce complex, evidence-backed analyses
            through its <span className="font-semibold text-white">Deep Insight</span> and{' '}
            <span className="font-semibold text-white">Dashboard</span> modules.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-navy-300">
            Its <span className="font-semibold text-white">Quick Insight</span> module
            handles natural-language questions in real time — translating each
            into governed SQL, returning charts, tables, and narrative summaries
            against the same connected data.
          </p>
          <p className="mt-4 text-[12.5px] leading-relaxed text-navy-400">
            Sandboxed demo. Pick a persona on the right to enter the
            workspace from their vantage point.
          </p>
        </div>

        <div className="relative z-10 text-[11.5px] text-navy-400">
          © {new Date().getFullYear()} DataLens
        </div>
      </div>

      {/* Right — tile picker */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-10 sm:py-14">
        <div className="w-full max-w-2xl">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center gap-1 lg:hidden">
            <InsightSmartLogo height={26} />
          </div>

          <h2 className="text-[22px] font-bold tracking-tight text-navy-900">
            Choose a persona to begin
          </h2>
          <p className="mt-1 text-[13px] text-navy-500">
            Each persona shows the workspace from a different angle —
            governance, oversight, or daily use.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-danger-500/20 bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-700">
              {error}
            </div>
          )}

          {!grouped ? (
            <div className="mt-10 flex items-center justify-center text-navy-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-[13px]">Loading personas…</span>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* Admin */}
              {grouped.admin && (
                <Section label="Admin">
                  <UserTile
                    user={grouped.admin}
                    loading={loadingId === grouped.admin.id}
                    disabled={!!loadingId}
                    onClick={() => handlePick(grouped.admin!)}
                  />
                </Section>
              )}

              {/* Each manager + their reports */}
              {grouped.managers.map((m) => {
                const reports = grouped.usersByMgr.get(m.id) || [];
                return (
                  <Section key={m.id} label={`${m.name}'s team`}>
                    <UserTile
                      user={m}
                      loading={loadingId === m.id}
                      disabled={!!loadingId}
                      onClick={() => handlePick(m)}
                    />
                    {reports.map((u) => (
                      <UserTile
                        key={u.id}
                        user={u}
                        loading={loadingId === u.id}
                        disabled={!!loadingId}
                        onClick={() => handlePick(u)}
                      />
                    ))}
                  </Section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section wrapper (label + 2-col tile grid) ─── */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-navy-500">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ─── Single user tile ─── */
function UserTile({
  user,
  loading,
  disabled,
  onClick,
}: {
  user: DemoUser;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tone = roleTone(user.role);
  const Icon = roleIcon(user.role);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${tone.border}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg} ${tone.iconText} ring-1 ring-inset ${tone.iconRing}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-navy-900">
          {user.name}
        </span>
        <span className="block truncate text-[11.5px] text-navy-500">
          {user.title || user.email}
        </span>
      </span>
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-navy-400" />
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 text-navy-300 transition-all group-hover:translate-x-0.5 group-hover:text-accent-600" />
      )}
    </button>
  );
}

function roleIcon(role: string) {
  if (role === 'admin') return Crown;
  if (role === 'manager') return Briefcase;
  return User;
}

function roleTone(role: string) {
  if (role === 'admin') {
    return {
      border: 'border-amber-200 hover:border-amber-300',
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-700',
      iconRing: 'ring-amber-200',
    };
  }
  if (role === 'manager') {
    return {
      border: 'border-violet-200 hover:border-violet-300',
      iconBg: 'bg-violet-50',
      iconText: 'text-violet-700',
      iconRing: 'ring-violet-200',
    };
  }
  return {
    border: 'border-navy-100 hover:border-accent-200',
    iconBg: 'bg-accent-50',
    iconText: 'text-accent-700',
    iconRing: 'ring-accent-200',
  };
}

// Suppress lint about Shield being unused if we ever remove it; keep import
// for future role-tone variants.
const _refs = { Shield };
void _refs;
