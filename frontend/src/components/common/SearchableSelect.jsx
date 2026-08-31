import React, { useState, useRef, useEffect } from "react";

export const SearchableSelect = ({ options = [], value, onChange, placeholder = "Rechercher...", style = {} }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    React.createElement("div", { ref: containerRef, style: { position: "relative", ...style } },
      React.createElement("input", {
        type: "text",
        className: "form-input form-input-sm",
        value: open ? query : (selected?.label || ""),
        onChange: handleInputChange,
        onFocus: () => { setOpen(true); setQuery(""); },
        placeholder: placeholder,
        style: { width: "100%", cursor: "text" }
      }),
      open && filtered.length > 0 && React.createElement("div", {
        style: {
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "#1e293b", border: "1px solid var(--border-color)",
          borderRadius: "6px", maxHeight: "220px", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", marginTop: "2px"
        }
      }, filtered.map(opt =>
        React.createElement("div", {
          key: opt.value,
          onMouseDown: () => handleSelect(opt),
          style: {
            padding: "0.45rem 0.75rem", cursor: "pointer", fontSize: "0.82rem",
            background: String(opt.value) === String(value) ? "rgba(59,130,246,0.2)" : "transparent",
            color: String(opt.value) === String(value) ? "#60a5fa" : "#cbd5e1",
            borderBottom: "1px solid rgba(255,255,255,0.04)"
          }
        }, opt.label)
      )),
      open && filtered.length === 0 && React.createElement("div", {
        style: {
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "#1e293b", border: "1px solid var(--border-color)",
          borderRadius: "6px", padding: "0.5rem 0.75rem", fontSize: "0.8rem",
          color: "#64748b", marginTop: "2px"
        }
      }, "Aucun article trouve")
    )
  );
};
