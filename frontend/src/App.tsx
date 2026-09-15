import { Component, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import LoginPage from './pages/LoginPage';

import WorkspaceView from './pages/WorkspaceView';
import PendingApprovalPage from './pages/PendingApprovalPage';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import ModelRegistry from './pages/ModelRegistry';
import AcceleratorCatalog from './pages/AcceleratorCatalog';
import InstallAccelerator from './pages/InstallAccelerator';
import NewAccelerator from './pages/NewAccelerator';
import SolutionHome from './pages/SolutionHome';
import SolutionAgent from './pages/SolutionAgent';
import InventoryAccelerator from './pages/inventory/InventoryAccelerator';
import WorkspaceSelectionPage from './pages/WorkspaceSelectionPage';
import DashboardsPage from './pages/DashboardsPage';
import DashboardViewPage from './pages/DashboardViewPage';
import ConfirmProvider from './components/common/ConfirmProvider';
import { useAuthStore } from './store/authStore';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 font-sans">
          <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-navy-900">Something went wrong</h2>
            <p className="mt-2 break-words text-[13.5px] leading-relaxed text-navy-500">
              {this.state.error.message}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-[13px] font-semibold text-navy-700 shadow-sm transition-colors hover:bg-navy-50"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
              >
                Back to home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({
  children,
  adminOnly = false,
  privilegedOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  privilegedOnly?: boolean;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Redirect pending/suspended users to the pending page
  if (user && (user.status === 'pending' || user.status === 'suspended')) {
    return <Navigate to="/pending" replace />;
  }

  // Admin-only routes
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Privileged routes (admin or manager)
  if (privilegedOnly && user?.role !== 'admin' && user?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Standalone accelerator build: boot straight into the inventory app, no login.
const STANDALONE = import.meta.env.VITE_STANDALONE_ACCELERATOR === 'true';

function HomeRoute() {
  const user = useAuthStore((s) => s.user);
  // Admins & managers land on admin dashboard
  if (user?.role === 'admin' || user?.role === 'manager') return <Navigate to="/admin" replace />;
  // Regular users land on the workspace picker
  return <WorkspaceSelectionPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConfirmProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pending" element={<PendingApprovalPage />} />
        <Route path="/admin" element={<ProtectedRoute privilegedOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute privilegedOnly><AnalyticsDashboard /></ProtectedRoute>} />
        <Route path="/model-registry" element={<ProtectedRoute adminOnly><ModelRegistry /></ProtectedRoute>} />
        <Route path="/accelerators" element={<ProtectedRoute privilegedOnly><AcceleratorCatalog /></ProtectedRoute>} />
        <Route path="/accelerators/new" element={<ProtectedRoute privilegedOnly><NewAccelerator /></ProtectedRoute>} />
        <Route path="/accelerators/:slug/install" element={<ProtectedRoute privilegedOnly><InstallAccelerator /></ProtectedRoute>} />
        <Route path="/solution/:workspaceId" element={<ProtectedRoute privilegedOnly><SolutionHome /></ProtectedRoute>} />
        <Route path="/solution/:workspaceId/agent" element={<ProtectedRoute privilegedOnly><SolutionAgent /></ProtectedRoute>} />
        <Route path="/accelerator/inventory-optimization/*" element={STANDALONE ? <InventoryAccelerator /> : <ProtectedRoute privilegedOnly><InventoryAccelerator /></ProtectedRoute>} />
        <Route path="/" element={STANDALONE ? <Navigate to="/accelerator/inventory-optimization" replace /> : <ProtectedRoute><HomeRoute /></ProtectedRoute>} />
        <Route
          path="/workspace/:workspaceId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <WorkspaceView />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:workspaceId/dashboards"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <DashboardsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:workspaceId/dashboard/:dashboardId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <DashboardViewPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
      </Routes>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}
