import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

export const SmartSearchBar = React.forwardRef(({
  value, onChange, onClear,
  placeholder = "Rechercher...",
  results = [], loading = false, style = {}, onFocus,
}, ref) => {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [dropPos, setDropPos] = useState({});
  const containerRef = useRef(null);

  const flatItems = results.flatMap((g) => g.items);

  const calcPos = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  }, []);

  useEffect(() => {
    setFocusedIdx(-1);
    if (value && value.length > 0) { calcPos(); setOpen(true); } else setOpen(false);
  }, [results, value]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => { window.removeEventListener("scroll", calcPos, true); window.removeEventListener("resize", calcPos); };
  }, [open, calcPos]);

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target) && !e.target.closest("[data-ssd]")) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx(p => Math.min(p + 1, flatItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx(p => Math.max(p - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const t = focusedIdx >= 0 ? flatItems[focusedIdx] : flatItems[0]; if (t) { t.onSelect(); setOpen(false); } }
    else if (e.key === "Escape") setOpen(false);
  };

  const dropdown = open && value && value.length > 0 && (
    <div data-ssd="true" style={{
      position: "absolute",
      top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999,
      background: "var(--bg-surface)", border: "1px solid #334155", borderRadius: "10px",
      boxShadow: "0 16px 48px rgba(0,0,0,0.7)", overflow: "hidden", maxHeight: "380px", overflowY: "auto",
    }}>
      {loading
        ? <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>Recherche...</div>
        : flatItems.length === 0
          ? <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>Aucun resultat pour "{value}"</div>
          : results.map(group => (
            <div key={group.category}>
              <div style={{ padding: "0.35rem 0.75rem", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.1em", color: "#475569", textTransform: "uppercase", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid #1e2a3a" }}>{group.category}</div>
              {group.items.map(item => {
                const gi = flatItems.indexOf(item);
                return (
                  <div key={item.key}
                    onMouseDown={(e) => { e.preventDefault(); item.onSelect(); setOpen(false); }}
                    onMouseEnter={() => setFocusedIdx(gi)}
                    style={{ padding: "0.55rem 0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.04)", background: focusedIdx === gi ? "rgba(99,102,241,0.15)" : "transparent", transition: "background 0.12s" }}>
                    {item.icon && <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "600", color: "white", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                      {(item.sub1 || item.sub2) && <div style={{ fontSize: "0.73rem", color: "#94a3b8", display: "flex", gap: "0.75rem", marginTop: "1px" }}>{item.sub1 && <span>{item.sub1}</span>}{item.sub2 && <span style={{ color: "#64748b" }}>{item.sub2}</span>}</div>}
                    </div>
                    {item.badge && <span style={{ padding: "0.15rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: "700", flexShrink: 0, background: (item.badgeColor || "#6366f1") + "22", color: item.badgeColor || "#6366f1", border: "1px solid " + (item.badgeColor || "#6366f1") + "55" }}>{item.badge}</span>}
                  </div>
                );
              })}
            </div>
          ))
      }
    </div>
  );

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", ...style }}>
        <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none", zIndex: 1 }} />
        <input
          ref={ref}
          className="form-input"
          style={{ paddingLeft: "2.5rem", paddingRight: value ? "2.5rem" : "0.75rem" }}
          value={value}
          onChange={(e) => { onChange(e.target.value); calcPos(); setOpen(true); }}
          onFocus={() => { calcPos(); setOpen(true); if (onFocus) onFocus(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {value && <button onClick={() => { onClear(); setOpen(false); }} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 0, zIndex: 1 }}><X size={14} /></button>}
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
});

SmartSearchBar.displayName = 'SmartSearchBar';
