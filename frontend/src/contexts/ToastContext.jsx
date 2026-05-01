import { createContext, useCallback, useRef, useState } from "react";

export const ToastContext = createContext(null);

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 3000;

let nextToastId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timerId = timersRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ kind = "info", message }) => {
      const id = nextToastId++;
      const toast = { id, kind, message };

      setToasts((current) => {
        const next = [...current, toast];
        if (next.length > MAX_VISIBLE) {
          const removed = next.shift();
          if (removed) {
            const timerId = timersRef.current.get(removed.id);
            if (timerId) {
              clearTimeout(timerId);
              timersRef.current.delete(removed.id);
            }
          }
        }
        return next;
      });

      const timerId = setTimeout(() => {
        removeToast(id);
      }, AUTO_DISMISS_MS);

      timersRef.current.set(id, timerId);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item is-${toast.kind}`}>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss"
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
