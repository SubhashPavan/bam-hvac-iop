import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Imperative replacement for `window.confirm`. Wraps the styled
 * `ConfirmDialog` so any component can do:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete this block?',
 *     message: 'This cannot be undone.',
 *     variant: 'danger',
 *     confirmLabel: 'Delete',
 *   });
 *   if (!ok) return;
 *
 * One provider mounted near the app root, one promise per call,
 * resolved when the user clicks Cancel or Confirm.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback so the call doesn't throw if the provider is missing —
    // the app degrades to the native browser dialog rather than crashing.
    return async (opts) => window.confirm(opts.message || opts.title);
  }
  return ctx;
}

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };
  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        isOpen={!!pending}
        title={pending?.title || ''}
        message={pending?.message || ''}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        variant={pending?.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}
