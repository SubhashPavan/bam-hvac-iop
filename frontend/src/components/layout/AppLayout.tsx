import type { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';

interface AppLayoutProps {
  /** Page title shown in the header */
  title: string;
  /** Optional subtitle under the title */
  subtitle?: string;
  /** Optional right-side controls in the header */
  actions?: ReactNode;
  /** Page content */
  children: ReactNode;
  /** Override the matched nav item (useful for nested routes) */
  activePath?: string;
  /** When true, drops the max-width + padding wrapper so content can use full height */
  fluid?: boolean;
}

export default function AppLayout({
  title,
  subtitle,
  actions,
  children,
  activePath,
  fluid = false,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-navy-50">
      <AppSidebar activePath={activePath} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 overflow-y-auto">
          {fluid ? (
            children
          ) : (
            <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
