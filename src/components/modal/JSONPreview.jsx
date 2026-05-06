import { useRef, useEffect } from "react";
import { useApp } from "../../context";
import hljs from 'highlight.js/lib/core'

export default function JSONPreview({ json, onToggle }) {
    const codeRef = useRef(null);
    const { addToast } = useApp();

    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.innerHTML = hljs.highlight(json, { language: 'json' }).value;
        }
    }, [json]);

    const copy = () => {
        navigator.clipboard.writeText(json).then(() => addToast({ type: 'success', message: 'Copied to clipboard' }));
    };

    return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview</span>
            <div className="flex items-center gap-1">
                <button onClick={copy} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    Copy
                </button>
                {onToggle && (
                <button onClick={onToggle} className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 lg:hidden">
                    Hide
                </button>
                )}
            </div>
        </div>
        <pre className="flex-1 overflow-auto text-xs p-4 bg-slate-50/50"><code ref={codeRef} className="language-json" /></pre>
    </div>
    );
}