import { useState } from "react";

export default function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {children}
        {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 rounded bg-slate-800 px-2 py-1.5 text-xs text-white z-50 pointer-events-none shadow-lg">
            {text}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
        )}
    </span>
  );
}