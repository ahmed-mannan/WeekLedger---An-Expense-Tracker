import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  details = [],
  confirmLabel,
  tone = 'primary',
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, isProcessing, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/60 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-6 transition-transform duration-150">
        <div className="flex items-start justify-between gap-4">
          <h3
            id="confirm-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Close confirmation dialog"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {description}
        </p>

        {details.length > 0 && (
          <dl className="mt-4 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-2">
            {details.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <dt className="text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums text-right truncate max-w-[220px]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:outline-rose-600'
                : 'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-zinc-950 focus-visible:outline-emerald-600'
            } disabled:opacity-60`}
          >
            {isProcessing ? 'Updating Sheet...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
