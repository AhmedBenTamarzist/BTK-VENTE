import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const COLORS = {
  success: { bg: "#052e16", border: "#16a34a", color: "#4ade80", icon: "#22c55e" },
  error:   { bg: "#2d0a0a", border: "#dc2626", color: "#f87171", icon: "#ef4444" },
  warning: { bg: "#1c1202", border: "#d97706", color: "#fbbf24", icon: "#f59e0b" },
  info:    { bg: "#0a1628", border: "#3b82f6", color: "#93c5fd", icon: "#60a5fa" },
};

let _addToast = null;

// Imperative API: toast.success("msg"), toast.error("msg"), etc.
export const toast = {
  success: (msg, duration) => _addToast?.({ type: "success", msg, duration }),
  error:   (msg, duration) => _addToast?.({ type: "error",   msg, duration: duration ?? 5000 }),
  warning: (msg, duration) => _addToast?.({ type: "warning", msg, duration }),
  info:    (msg, duration) => _addToast?.({ type: "info",    msg, duration }),
};

let _uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const add = useCallback(({ type = "info", msg, duration = 4000 }) => {
    const id = ++_uid;
    setToasts(p => [...p, { id, type, msg }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  // Expose imperatively
  _addToast = add;

  const toastList = createPortal(
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem",
      zIndex: 999999, display: "flex", flexDirection: "column-reverse", gap: "0.6rem",
      maxWidth: "380px", width: "calc(100vw - 2rem)",
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info;
        return (
          <div key={t.id} style={{
            pointerEvents: "all",
            display: "flex", alignItems: "flex-start", gap: "0.65rem",
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: "12px", padding: "0.85rem 1rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            animation: "toast-in 0.25s ease",
            color: c.color, fontSize: "0.875rem", lineHeight: 1.4,
          }}>
            <span style={{ color: c.icon, flexShrink: 0, marginTop: "1px" }}>{ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button onClick={() => remove(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: c.color, opacity: 0.6, padding: 0, flexShrink: 0,
              display: "flex", alignItems: "center",
            }}><X size={14} /></button>
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <ToastContext.Provider value={add}>
      {children}
      {toastList}
      <style>{`@keyframes toast-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
