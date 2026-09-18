import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const TOAST_EVENT = 'app:snackbar-message';

/**
 * Dispatch a backend error toast notification.
 * @param {string} message - Error message to display
 */
export function showBackendError(message) {
  if (!message) return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'error',
        message,
      },
    })
  );
}

/**
 * Dispatch a success toast notification.
 * @param {string} message - Success message to display
 */
export function showBackendSuccess(message) {
  if (!message) return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'success',
        message,
      },
    })
  );
}

/**
 * Top-right floating Snackbar Notification Container.
 * Renders maximum 3 toasts simultaneously with auto-dismiss after 4 seconds.
 */
export default function SnackbarContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleAddToast = (event) => {
      const newToast = event.detail;
      setToasts((prev) => {
        // Enforce maximum 3 toasts at a time (drop oldest if exceeding 3)
        const updated = [...prev, newToast];
        if (updated.length > 3) {
          return updated.slice(updated.length - 3);
        }
        return updated;
      });

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    window.addEventListener(TOAST_EVENT, handleAddToast);
    return () => window.removeEventListener(TOAST_EVENT, handleAddToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 bg-slate-900/95 border rounded-xl shadow-2xl backdrop-blur-md text-slate-100 animate-in fade-in slide-in-from-top-3 duration-200 ${
              isSuccess
                ? 'border-emerald-500/40 shadow-emerald-500/5'
                : 'border-rose-500/40 shadow-rose-500/5'
            }`}
            role="alert"
          >
            <div
              className={`p-1 rounded-lg shrink-0 mt-0.5 ${
                isSuccess
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p
                className={`text-xs font-semibold tracking-wide uppercase ${
                  isSuccess ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isSuccess ? 'Success' : 'Error'}
              </p>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed break-words font-medium">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
