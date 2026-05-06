import { useState } from "react";
import { useApp } from "../../context";
import { makeProvider } from "../../Utilities";
import { TEMPLATES } from "../../Constants";
import Modal from "../Modal";

export default function AddProviderModal({ onClose }) {
    const { dispatch, state } = useApp();
    const [selected, setSelected] = useState(null);

    const handleAdd = () => {
        const template = TEMPLATES.find(t => t.id === selected);
        if (!template)
            return;
        const existingIds = state.providers.map(p => p.id);
        let id = template.defaultProviderId;
        if (existingIds.includes(id)) {
            let n = 2;
            while (existingIds.includes(`${id}-${n}`))
                n++;
            id = `${id}-${n}`;
        }
        dispatch({ type: 'ADD_PROVIDER', payload: makeProvider(template, id) });
        onClose();
    };

    return (
    <Modal title="Add Provider" onClose={onClose} wide>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMPLATES.map(t => (
                <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
                        selected === t.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                >
                    <span className="text-3xl">{t.emoji}</span>
                    <span className="font-medium text-sm">{t.label}</span>
                    {t.id !== 'custom' && <span className="text-xs text-slate-400">:{t.port}</span>}
                </button>
            ))}
        </div>
        {selected && TEMPLATES.find(t => t.id === selected)?.note && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            {TEMPLATES.find(t => t.id === selected).note}
        </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button
                onClick={handleAdd}
                disabled={!selected}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Add Provider
            </button>
        </div>
    </Modal>
    );
}