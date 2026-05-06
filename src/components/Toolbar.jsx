import { useState } from "react";
import { useApp } from "../context";
import { serializeConfig } from "../Utilities";
import Tooltip from "./ui/Tooltip";

export default function Toolbar({ onNew, onImport, onAddProvider, onExport, exportDisabled, exportDisabledReason }) {
    const [showExportMenu, setShowExportMenu] = useState(false);
    const { state, addToast } = useApp();

    const copyJSON = () => {
        navigator.clipboard.writeText(serializeConfig(state)).then(() => addToast({ type: 'success', message: 'Copied to clipboard' }));
        setShowExportMenu(false);
    };

    return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 h-14 flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
            <span className="text-xl">⚙️</span>
            <span className="font-semibold text-slate-900 text-sm hidden sm:block">OpenCode Config Builder</span>
        </div>
        <button onClick={onNew} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200">New</button>
        <button onClick={onImport} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200">Import</button>
        <button onClick={onAddProvider} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Provider
        </button>
        <div className="flex-1" />
        <div className="relative">
            <div className="flex">
                <Tooltip text={exportDisabledReason || ''}>
                <button
                    onClick={exportDisabled ? undefined : onExport}
                    disabled={exportDisabled}
                    className={`rounded-l-lg px-4 py-1.5 text-sm font-medium text-white transition-colors ${exportDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    Download opencode.json
                </button>
                </Tooltip>
                <button
                    onClick={() => setShowExportMenu(v => !v)}
                    disabled={exportDisabled}
                    className={`rounded-r-lg border-l border-indigo-700/30 px-2 py-1.5 text-sm font-medium text-white ${exportDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    aria-label="More export options"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
            </div>
            {showExportMenu && !exportDisabled && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-50 fade-in">
                <button onClick={copyJSON} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Copy JSON</button>
                </div>
            )}
        </div>
    </header>
    );
}