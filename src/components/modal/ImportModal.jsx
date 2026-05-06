import { useState, useRef } from "react";
import { useApp } from "../../Context";
import Modal from "../Modal";
import { parseConfig } from "../../Utilities";

export default function ImportModal({ onClose }) {
    const { dispatch, addToast } = useApp();
    const [tab, setTab] = useState('upload');
    const [pasteText, setPasteText] = useState('');
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef();

    const handleJSON = (str) => {
        setError(null);
        try {
            dispatch({ type: 'LOAD', payload: parseConfig(str) });
            addToast({ type: 'success', message: 'Config imported successfully' });
            onClose();
        } catch (e) {
            setError(`Parse error: ${e.message}`);
        }
    };

    const handleFile = (file) => {
        if (!file)
            return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            setError('Only .json files are accepted');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => handleJSON(e.target.result);
        reader.readAsText(file);
    };

    return (
    <Modal title="Import Config" onClose={onClose} wide>
    <div className="flex gap-1 mb-4 border-b border-slate-100">
        {['upload', 'paste'].map(t => (
        <button
            key={t}
            onClick={() => { setTab(t); setError(null); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors -mb-px border-b-2 ${tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            {t === 'upload' ? 'Upload File' : 'Paste JSON'}
        </button>
        ))}
    </div>

    {tab === 'upload' ? (
        <div
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <p className="text-slate-600 font-medium mb-1">Drop your opencode.json here</p>
            <p className="text-sm text-slate-400 mb-4">or</p>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Browse file
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
    ) : (
        <div>
            <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your opencode.json content here..."
                className="w-full h-48 rounded-lg border border-slate-300 p-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => handleJSON(pasteText)}
                    disabled={!pasteText.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                    Load
                </button>
            </div>
        </div>
    )}

    {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <span className="font-medium">Error:</span> {error}
        </div>
    )}
    </Modal>
    );
}