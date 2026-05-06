import { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react'
import { uid, buildURL, parseURL, makeProvider, serializeConfig, parseConfig, validate, getModelHint } from './Utilities'
import { LS_KEY, TEMPLATES } from './Constants'
import { useApp, AppCtx } from './Context'
import EmptyState from './components/EmptyState'
import ProviderList from './components/ProviderList'
import ToastContainer from './components/ToastContainer'
import Toolbar from './components/Toolbar'

// UI
import Badge from './components/ui/Badge'
import FieldError from './components/ui/FieldError'
import FieldWarning from './components/ui/FieldWarning'
import InfoIcon from './components/ui/InfoIcon'
import Toggle from './components/ui/Toggle'
import Tooltip from './components/ui/Tooltip'

// Provider
import BaseURLEditor from './components/provider/BaseURLEditor'
import ModelRow from './components/provider/ModelRow'
import ProviderCard from './components/provider/ProviderCard'

// Modal
import AddProviderModal from './components/modal/AddProviderModal'
import DefaultModelSelector from './components/modal/DefaultModelSelector'
import ImportModal from './components/modal/ImportModal'
import JSONPreview from './components/modal/JSONPreview'
import ResumeModal from './components/modal/ResumeModal'

import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/github.min.css'

hljs.registerLanguage('json', json)

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState = {
    providers: [],
    defaultModel: null,
    _unknownFields: {}
};

function reducer(state, action) {
    switch (action.type) {
    case 'LOAD':
        return action.payload;
    case 'RESET':
        return { ...initialState };
    case 'ADD_PROVIDER':
        return { ...state, providers: [...state.providers, action.payload] };
    case 'UPDATE_PROVIDER': {
        const { key, updates } = action.payload;
        const old = state.providers.find(p => p._key === key);
        const providers = state.providers.map(p => p._key === key ? { ...p, ...updates } : p);
        let defaultModel = state.defaultModel;
        if (old && updates.id && old.id !== updates.id && defaultModel?.startsWith(old.id + '/')) {
            defaultModel = updates.id + '/' + defaultModel.slice(old.id.length + 1);
        }
        return { ...state, providers, defaultModel };
    }
    case 'DELETE_PROVIDER': {
        const old = state.providers.find(p => p._key === action.payload);
        const providers = state.providers.filter(p => p._key !== action.payload);
        let defaultModel = state.defaultModel;
        if (old && defaultModel?.startsWith(old.id + '/'))
            defaultModel = null;
        return { ...state, providers, defaultModel };
    }
    case 'REORDER_PROVIDERS':
        return { ...state, providers: action.payload };
    case 'ADD_MODEL': {
        const { provKey, model, atIndex } = action.payload;
        return {
            ...state,
            providers: state.providers.map(p => {
                if (p._key !== provKey)
                    return p;
                const models = [...p.models];
                if (atIndex !== undefined)
                    models.splice(atIndex, 0, model);
                else
                    models.push(model);
                return { ...p, models };
            }),
        };
    }
    case 'UPDATE_MODEL': {
        const { provKey, key, updates } = action.payload;
        const prov = state.providers.find(p => p._key === provKey);
        const old = prov?.models.find(m => m._key === key);
        const providers = state.providers.map(p =>
            p._key === provKey ? { ...p, models: p.models.map(m => m._key === key ? { ...m, ...updates } : m) } : p
        );
        let defaultModel = state.defaultModel;
        if (prov && old && updates.id && old.id !== updates.id && defaultModel === `${prov.id}/${old.id}`) {
            defaultModel = `${prov.id}/${updates.id}`;
        }
        return { ...state, providers, defaultModel };
    }
    case 'DELETE_MODEL': {
        const { provKey, key } = action.payload;
        const prov = state.providers.find(p => p._key === provKey);
        const m = prov?.models.find(m => m._key === key);
        let defaultModel = state.defaultModel;
        if (prov && m && defaultModel === `${prov.id}/${m.id}`)
            defaultModel = null;
        return {
            ...state,
            defaultModel,
            providers: state.providers.map(p =>
                p._key === provKey ? { ...p, models: p.models.filter(m => m._key !== key) } : p
            ),
        };
    }
    case 'REORDER_MODELS': {
        const { provKey, models } = action.payload;
        return { ...state, providers: state.providers.map(p => p._key === provKey ? { ...p, models } : p) };
    }
    case 'SET_DEFAULT_MODEL':
        return { ...state, defaultModel: action.payload };
    default:
        return state;
    }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [showImport, setShowImport] = useState(false);
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [showResume, setShowResume] = useState(false);
    const [previewCollapsed, setPreviewCollapsed] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [pendingDeletes, setPendingDeletes] = useState({});
    const savedRef = useRef(null);

    useEffect(() => {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
            savedRef.current = JSON.parse(saved); setShowResume(true);
        }
    } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        } catch {}
    }, [state]);

    const addToast = useCallback((toast) => {
        const id = uid();
        setToasts(prev => [...prev, { id, ...toast }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), toast.duration || 3500);
    }, []);

    const deleteModel = useCallback((provKey, model) => {
        dispatch({ type: 'DELETE_MODEL', payload: { provKey, key: model._key } });
        const pendingKey = `${provKey}:${model._key}`;
        const timer = setTimeout(() => {
            setPendingDeletes(prev => { const n = { ...prev }; delete n[pendingKey]; return n; });
        }, 5000);
        setPendingDeletes(prev => ({ ...prev, [pendingKey]: { provKey, model, timer } }));
        const toastId = uid();
        setToasts(prev => [...prev, {
            id: toastId, type: 'info',
            message: `"${model.id || 'Model'}" deleted`,
            onUndo: () => undoDelete(pendingKey),
        }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 5000);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const undoDelete = useCallback((pendingKey) => {
        setPendingDeletes(prev => {
            const entry = prev[pendingKey];
            if (!entry)
                return prev;
            clearTimeout(entry.timer);
            dispatch({ type: 'ADD_MODEL', payload: { provKey: entry.provKey, model: entry.model } });
            const n = { ...prev };
            delete n[pendingKey];
            return n;
        });
        setToasts(prev => prev.filter(t => !t.onUndo));
    }, []);

    const json = useMemo(() => serializeConfig(state), [state]);
    const validation = useMemo(() => validate(state), [state]);
    const canExport = validation.errors.length === 0;

    const handleExport = () => {
        try {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'opencode.json'; a.click();
            URL.revokeObjectURL(url);
        } catch {
            const win = window.open('', '_blank');
            win.document.write(`<pre>${json}</pre>`);
        }
    };

    const handleNew = () => {
        if (state.providers.length > 0 && !window.confirm('Start over? This will clear the current config.'))
            return;
        dispatch({ type: 'RESET' });
        try {
            localStorage.removeItem(LS_KEY); 
        } catch {}
    };

    const ctx = { state, dispatch, validation, addToast, deleteModel, undoDelete, pendingDeletes };

    return (
    <AppCtx.Provider value={ctx}>
        {showResume && (
        <ResumeModal
            onResume={() => { dispatch({ type: 'LOAD', payload: savedRef.current }); setShowResume(false); }}
            onFresh={() => setShowResume(false)}
        />
        )}
        {showImport && <ImportModal onClose={() => setShowImport(false)} />}
        {showAddProvider && <AddProviderModal onClose={() => setShowAddProvider(false)} />}

        <Toolbar
            onNew={handleNew}
            onImport={() => setShowImport(true)}
            onAddProvider={() => setShowAddProvider(true)}
            onExport={handleExport}
            exportDisabled={!canExport}
            exportDisabledReason={!canExport ? validation.errors.map(e => e.message).join('; ') : ''}
        />

        {validation.errors.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 flex-wrap">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            <span className="text-sm text-red-700 font-medium">Fix {validation.errors.length} error{validation.errors.length > 1 ? 's' : ''} to enable export:</span>
            {validation.errors.map((e, i) => <Badge key={i} type="error">{e.message}</Badge>)}
        </div>
        )}

        <main className="max-w-screen-xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
            <div className="space-y-4">
                {state.providers.length > 0 && <DefaultModelSelector />}
                {state.providers.length === 0 ? (
                <EmptyState onAddProvider={() => setShowAddProvider(true)} onImport={() => setShowImport(true)} />
                ) : (
                <>
                    <ProviderList providers={state.providers} />
                    <button
                        onClick={() => setShowAddProvider(true)}
                        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors w-full justify-center"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Add Provider
                    </button>
                </>
                )}
            </div>

            <div className="hidden lg:flex flex-col sticky top-20" style={{ height: 'calc(100vh - 6rem)' }}>
                <JSONPreview json={json} />
            </div>
        </main>

        <div className="lg:hidden fixed bottom-4 left-4 z-40">
            <button
                onClick={() => setPreviewCollapsed(v => !v)}
                className="rounded-full bg-indigo-600 text-white shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                {previewCollapsed ? 'Preview JSON' : 'Hide'}
            </button>
        </div>

        {!previewCollapsed && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 h-1/2 z-40 slide-up">
            <JSONPreview json={json} onToggle={() => setPreviewCollapsed(true)} />
        </div>
        )}

        <ToastContainer toasts={toasts} />
    </AppCtx.Provider>
    );
}
