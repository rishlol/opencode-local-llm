import { useRef } from "react";
import { useApp } from "../../Context";
import { getModelHint, uid } from "../../Utilities";
import InfoIcon from "../ui/InfoIcon";
import Toggle from "../ui/Toggle";

export default function ModelRow({ model, provider, index, onDelete }) {
    const { dispatch, validation, pendingDeletes, undoDelete } = useApp();
    const pendingKey = `${provider._key}:${model._key}`;
    const isPending = !!pendingDeletes[pendingKey];
    const hint = getModelHint(provider);
    const idErr = validation.errors.find(e => e.key === model._key && e.field === 'id');
    const dragRef = useRef(null);

    const update = (field, val) =>
    dispatch({
        type: 'UPDATE_MODEL',
        payload: {
            provKey: provider._key,
            key: model._key,
            updates: { [field]: val }
        }
    });

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${provider._key}|${index}`);
        dragRef.current = index;
    };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (!data)
            return;
        const [pk, fromIdx] = data.split('|');
        if (pk !== provider._key)
            return;
        const from = parseInt(fromIdx);
        if (from === index)
            return;
        const models = [...provider.models];
        const [moved] = models.splice(from, 1);
        models.splice(index, 0, moved);
        dispatch({
            type: 'REORDER_MODELS',
            payload: {
                provKey: provider._key, models
            }
        });
    };

    if (isPending) {
    return (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 fade-in">
            <span className="flex-1">Model &ldquo;{model.id}&rdquo; deleted</span>
            <button onClick={() => undoDelete(pendingKey)} className="text-indigo-600 font-medium hover:underline">Undo</button>
        </div>
    );
    }

    return (
    <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="group flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 hover:border-slate-200 transition-colors"
    >
        <span className="mt-2.5 text-slate-300 group-hover:text-slate-400 flex-shrink-0" aria-hidden="true">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/></svg>
        </span>
        <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
            <div>
                <div className="flex items-center gap-1 mb-0.5">
                <label className="text-xs text-slate-500">Model ID</label>
                {hint && <InfoIcon tip={hint} />}
                </div>
                <input
                    value={model.id}
                    onChange={e => update('id', e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                        const newM = { _key: uid(), id: '', name: '', tools: false, _unknownFields: {} };
                        dispatch({ type: 'ADD_MODEL', payload: { provKey: provider._key, model: newM, atIndex: index + 1 } });
                        }
                    }}
                    placeholder="model-id"
                    className={`w-full rounded border ${idErr ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-indigo-400'} px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1`}
                />
                {idErr && <p className="text-xs text-red-600 mt-0.5">{idErr.message}</p>}
            </div>
            <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Display Name <span className="text-slate-400">(optional)</span></label>
                <input
                    value={model.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder={model.id || 'e.g. Llama 3.2'}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
            </div>
        </div>
        <div className="flex items-center gap-3 pt-5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
            <Toggle checked={model.tools} onChange={v => update('tools', v)} label="Tool calling" />
            <span className="text-xs text-slate-500">Tools</span>
        </div>
            <button
                onClick={() => onDelete(model)}
                aria-label="Delete model"
                className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
    </div>
    );
}