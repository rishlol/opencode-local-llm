import { useApp } from "../../context";

export default function DefaultModelSelector() {
    const { state, dispatch } = useApp();
    const options = state.providers.flatMap(p =>
    p.models.map(m => ({ value: `${p.id}/${m.id}`, label: `${p.id} / ${m.name || m.id}` }))
    );
    const currentValid = options.find(o => o.value === state.defaultModel);

    return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-2">
            Default Model
            <span className="ml-1 text-xs font-normal text-slate-400">(top-level <code className="bg-slate-100 rounded px-1">model</code> field)</span>
        </label>
        <select
            value={currentValid ? state.defaultModel : ''}
            onChange={e => dispatch({ type: 'SET_DEFAULT_MODEL', payload: e.target.value || null })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
            <option value="">None — OpenCode uses last selected</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    </div>
    );
}