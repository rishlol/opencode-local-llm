export default function EmptyState({ onAddProvider, onImport }) {
    return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">📄</div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">No providers configured</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-8">
            Add a local LLM provider to generate your <code className="bg-slate-100 rounded px-1 font-mono">opencode.json</code> config file.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={onAddProvider} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
                Start from a template
            </button>
            <button onClick={onImport} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Import existing config
            </button>
        </div>
    </div>
    );
}