import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, RefreshCw, Clock, ShieldX } from 'lucide-react';
import InsightSmartLogo from '../components/common/InsightSmartLogo';
import { useAuthStore } from '../store/authStore';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');

  const isSuspended = user?.status === 'suspended';

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckMessage('');
    try {
      await refreshUser();
      const updatedUser = useAuthStore.getState().user;
      if (updatedUser?.status === 'active') {
        navigate('/', { replace: true });
      } else {
        setCheckMessage(
          'Your account is still ' + (updatedUser?.status || 'pending') + '. Please check back later.'
        );
      }
    } catch {
      setCheckMessage('Unable to check status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const statusTone = isSuspended
    ? { bg: 'bg-danger-50', ring: 'ring-danger-500/20', fg: 'text-danger-600' }
    : { bg: 'bg-warn-50', ring: 'ring-warn-500/25', fg: 'text-warn-600' };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <InsightSmartLogo height={26} />
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.08)] sm:p-10">
          {/* Avatar */}
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="mx-auto mb-4 h-16 w-16 rounded-full object-cover ring-2 ring-navy-100"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-navy-800 to-navy-900 text-[22px] font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}

          <h2 className="text-[17px] font-semibold text-navy-900">{user?.name || 'User'}</h2>
          <p className="mt-0.5 truncate text-[12.5px] text-navy-500">{user?.email}</p>

          <div className="my-6 h-px bg-navy-100" />

          {/* Status icon */}
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-inset ${statusTone.bg} ${statusTone.ring} ${statusTone.fg}`}
          >
            {isSuspended ? <ShieldX className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>

          <h1 className="mt-5 text-[20px] font-bold tracking-tight text-navy-900">
            {isSuspended ? 'Account suspended' : 'Pending approval'}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-navy-500">
            {isSuspended
              ? 'Your account has been suspended. Please contact an administrator for assistance.'
              : 'An administrator will review your access request shortly. You will be able to use DataLens once approved.'}
          </p>

          {checkMessage && (
            <div className="mt-5 rounded-lg border border-navy-100 bg-navy-50 px-3.5 py-2.5 text-[12.5px] text-navy-600">
              {checkMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? (
              <>
                <Loader2 className="is-spinner h-4 w-4" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Check status
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-navy-700 transition-colors hover:bg-navy-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
