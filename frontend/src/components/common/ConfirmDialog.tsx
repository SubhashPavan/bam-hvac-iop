import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          {variant === 'danger' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[15.5px] font-semibold tracking-tight text-navy-900">{title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-navy-600">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-navy-100 bg-navy-50/50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-navy-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-navy-700 transition-colors hover:bg-navy-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-colors ${
              variant === 'danger'
                ? 'bg-danger-600 hover:bg-danger-700'
                : 'bg-accent-500 hover:bg-accent-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
