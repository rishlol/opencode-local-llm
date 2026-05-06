import { useState } from "react";
import { useApp } from "../../context";
import { uid } from "../../Utilities";
import { TEMPLATES } from "../../Constants";
import BaseURLEditor from "./BaseURLEditor";
import ModelRow from "./ModelRow";

export default function ProviderCard({ provider, index }) {
    const { dispatch, validation, deleteModel } = useApp();
    const [showAll, setShowAll] = useState(false);

    const idErr = validation.errors.find(e => e.key === provider._key && e.field === 'id');
    const provWarn = validation.warnings.filter(w => w.key === provider._key && !w.field);

    const update = (field, val) => dispatch({ type: 'UPDATE_PROVIDER', payload: { key: provider._key, updates: { [field]: val } } });

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('provider', String(index));
    };

    const addModel = () => {
        const m = { _key: uid(), id: '', name: '', tools: false, _unknownFields: {} };
        dispatch({ type: 'ADD_MODEL', payload: { provKey: provider._key, model: m } });
    };

    const deleteProvider = () => {
        if (window.confirm(`Delete provider "${provider.id || 'this provider'}"?`)) {
            dispatch({ type: 'DELETE_PROVIDER', payload: provider._key });
        }
    };

    const template = TEMPLATES.find(t => t.id === provider._templateId);
    const isDocker = provider._templateId === 'docker';
    const visibleModels = showAll ? provider.models : provider.models.slice(0, 5);
    const hiddenCount = provider.models.length - 5;

    return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3 p-4">
            <span
                draggable
                onDragStart={handleDragStart}
                className="mt-1 text-slate-300 hover:text-slate-500 flex-shrink-0 cursor-grab"
                aria-label="Drag to reorder provider"
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/></svg>
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    {template && <span className="text-lg">{template.emoji}</span>}
                    <div className="flex-1 grid grid-cols-2 gap-3 min-w-0">
                        <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Provider ID <span className="text-slate-400">(JSON key)</span></label>
                        <input
                            value={provider.id}
                            onChange={e => update('id', e.target.value.replace(/\s/g, '-').toLowerCase())}
                            placeholder="my-provider"
                            className={`w-full rounded-lg border ${idErr ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-300 focus:ring-indigo-500'} px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1`}
                        />
                        {idErr && <p className="text-xs text-red-600 mt-0.5">{idErr.message}</p>}
                        </div>
                        <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Display Name <span className="text-slate-400">(optional)</span></label>
                        <input
                            value={provider.name}
                            onChange={e => update('name', e.target.value)}
                            placeholder="e.g. Ollama"
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        npm package <span className="font-normal text-slate-400">(read-only)</span>
                    </label>
                    <input
                        value={provider.npm}
                        readOnly
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-mono text-slate-500"
                    />
                </div>
                <div className="mt-3">
                    <BaseURLEditor
                        value={provider.baseURL}
                        onChange={v => update('baseURL', v)}
                        providerKey={provider._key}
                        isDocker={isDocker}
                    />
                </div>
                {((provider.apiKey !== undefined && provider.apiKey !== '') || isDocker) && (
                <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        API Key {isDocker && <span className="text-slate-400">(required for Docker)</span>}
                    </label>
                    <input
                        value={provider.apiKey}
                        onChange={e => update('apiKey', e.target.value)}
                        placeholder="docker"
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-mono w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                )}
                {template?.note && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <span className="font-medium">Note:</span> {template.note}
                </p>
                )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={() => update('_collapsed', !provider._collapsed)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={provider._collapsed ? 'Expand models' : 'Collapse models'}
                >
                    <svg className={`w-4 h-4 transition-transform ${provider._collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button
                    onClick={deleteProvider}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete provider"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>

        {provWarn.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
            {provWarn.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                {w.message}
            </p>
            ))}
        </div>
        )}

        {!provider._collapsed && (
        <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Models <span className="text-slate-400">({provider.models.length})</span></span>
            </div>
            {provider.models.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                <p className="text-sm text-slate-400">No models yet</p>
                <button onClick={addModel} className="mt-1 text-xs text-indigo-600 hover:underline font-medium">+ Add your first model</button>
            </div>
            ) : (
            <div className="space-y-1.5">
                {visibleModels.map((m, i) => (
                <ModelRow
                    key={m._key}
                    model={m}
                    provider={provider}
                    index={i}
                    onDelete={(model) => deleteModel(provider._key, model)}
                />
                ))}
                {!showAll && hiddenCount > 0 && (
                <button onClick={() => setShowAll(true)} className="w-full text-xs text-indigo-600 hover:underline py-1">
                    Show {hiddenCount} more model{hiddenCount > 1 ? 's' : ''}
                </button>
                )}
            </div>
            )}
            <button
                onClick={addModel}
                className="mt-2 flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors w-full justify-center"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                Add Model
            </button>
        </div>
        )}
    </div>
    );
}