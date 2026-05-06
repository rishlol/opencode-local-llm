import { useState, useReducer, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/github.min.css'

hljs.registerLanguage('json', json)

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEMA_URL = "https://opencode.ai/config.json";
const LS_KEY = "opencode-config-builder-v1";

const TEMPLATES = [
  {
    id: 'ollama', label: 'Ollama', emoji: '🦙',
    defaultProviderId: 'ollama', name: 'Ollama',
    npm: '@ai-sdk/openai-compatible',
    protocol: 'http', host: 'localhost', port: 11434, path: '/v1',
    note: 'Context window is limited by default — pass --ctx-size when running models',
    modelHint: 'Run `ollama list` to see valid model IDs',
    sampleModelId: 'llama3.2',
  },
  {
    id: 'lmstudio', label: 'LM Studio', emoji: '🎬',
    defaultProviderId: 'lmstudio', name: 'LM Studio',
    npm: '@ai-sdk/openai-compatible',
    protocol: 'http', host: 'localhost', port: 1234, path: '/v1',
    note: 'Start the LM Studio local server before connecting',
    modelHint: "Use the path shown in LM Studio's model list, e.g. `vendor/model-name`",
    sampleModelId: null,
  },
  {
    id: 'llamacpp', label: 'llama.cpp', emoji: '🦫',
    defaultProviderId: 'llamacpp', name: 'llama.cpp',
    npm: '@ai-sdk/openai-compatible',
    protocol: 'http', host: 'localhost', port: 8080, path: '/v1',
    note: 'Set --ctx-size to increase context window from the default 512 tokens',
    modelHint: 'Any descriptive string; does not need to match a filename',
    sampleModelId: null,
  },
  {
    id: 'docker', label: 'Docker Model Runner', emoji: '🐳',
    defaultProviderId: 'docker', name: 'Docker Model Runner',
    npm: '@ai-sdk/openai-compatible',
    protocol: 'http', host: 'localhost', port: 12434, path: '/engines/v1',
    apiKey: 'docker',
    note: 'Model IDs use the `ai/` namespace — e.g. `ai/llama3.2:1B-Q4_0`',
    modelHint: 'Include the `ai/` namespace prefix, e.g. `ai/llama3.2:1B-Q4_0`',
    sampleModelId: null,
  },
  {
    id: 'custom', label: 'Custom', emoji: '⚙️',
    defaultProviderId: 'my-provider', name: '',
    npm: '@ai-sdk/openai-compatible',
    protocol: 'http', host: 'localhost', port: 8080, path: '/v1',
    note: null, modelHint: null, sampleModelId: null,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 10);

function buildURL(protocol, host, port, path) {
  return `${protocol}://${host}:${port}${path || '/'}`;
}

function parseURL(url) {
  const m = url.match(/^(https?):\/\/([^:/]+)(?::(\d+))?(\/.*)?$/);
  if (m) return { protocol: m[1], host: m[2], port: m[3] ? parseInt(m[3]) : (m[1] === 'https' ? 443 : 80), path: m[4] || '/' };
  return { protocol: 'http', host: 'localhost', port: 8080, path: '/v1' };
}

function makeProvider(template, overrideId) {
  const id = overrideId || template.defaultProviderId;
  const baseURL = buildURL(template.protocol, template.host, template.port, template.path);
  const models = template.sampleModelId
    ? [{ id: template.sampleModelId, name: '', tools: true, _unknownFields: {}, _key: uid() }]
    : [];
  return {
    _key: uid(), id, npm: template.npm,
    name: template.name || '', baseURL,
    apiKey: template.apiKey || '',
    models, _unknownFields: {}, _collapsed: false,
    _templateId: template.id,
  };
}

function serializeConfig(state) {
  const out = { "$schema": SCHEMA_URL };
  if (state.defaultModel) out.model = state.defaultModel;
  Object.assign(out, state._unknownFields || {});
  const provObj = {};
  for (const prov of state.providers) {
    if (!prov.id) continue;
    const models = {};
    for (const m of prov.models) {
      if (!m.id) continue;
      const entry = { ...(m._unknownFields || {}) };
      if (m.name) entry.name = m.name;
      if (m.tools) entry.tools = true;
      models[m.id] = entry;
    }
    const options = { baseURL: prov.baseURL };
    if (prov.apiKey) options.apiKey = prov.apiKey;
    const provEntry = { npm: prov.npm || '@ai-sdk/openai-compatible' };
    if (prov.name) provEntry.name = prov.name;
    provEntry.options = options;
    provEntry.models = models;
    Object.assign(provEntry, prov._unknownFields || {});
    provObj[prov.id] = provEntry;
  }
  out.provider = provObj;
  return JSON.stringify(out, null, 2) + '\n';
}

function parseConfig(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const knownTop = new Set(['$schema', 'provider', 'model']);
  const unknownFields = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!knownTop.has(k)) unknownFields[k] = v;
  }
  const providers = [];
  if (parsed.provider && typeof parsed.provider === 'object') {
    for (const [id, pd] of Object.entries(parsed.provider)) {
      const knownProv = new Set(['npm', 'name', 'options', 'models']);
      const provUnknown = {};
      for (const [k, v] of Object.entries(pd || {})) {
        if (!knownProv.has(k)) provUnknown[k] = v;
      }
      const models = [];
      if (pd.models && typeof pd.models === 'object') {
        for (const [mid, md] of Object.entries(pd.models)) {
          const knownModel = new Set(['name', 'tools']);
          const modelUnknown = {};
          for (const [k, v] of Object.entries(md || {})) {
            if (!knownModel.has(k)) modelUnknown[k] = v;
          }
          models.push({
            _key: uid(), id: mid,
            name: md?.name || '',
            tools: md?.tools === true,
            _unknownFields: modelUnknown,
          });
        }
      }
      const opts = pd.options || {};
      providers.push({
        _key: uid(), id,
        npm: pd.npm || '@ai-sdk/openai-compatible',
        name: pd.name || '',
        baseURL: opts.baseURL || '',
        apiKey: opts.apiKey || '',
        models,
        _unknownFields: provUnknown,
        _collapsed: false,
        _templateId: null,
      });
    }
  }
  return { providers, defaultModel: parsed.model || null, _unknownFields: unknownFields };
}

function validate(state) {
  const errors = [], warnings = [];
  if (state.providers.length === 0) {
    errors.push({ scope: 'global', message: 'Add at least one provider to export' });
  }
  const seenProv = new Set();
  for (const prov of state.providers) {
    if (!prov.id) {
      errors.push({ scope: 'provider', key: prov._key, field: 'id', message: 'Provider ID is required' });
    } else if (seenProv.has(prov.id)) {
      errors.push({ scope: 'provider', key: prov._key, field: 'id', message: 'Provider ID must be unique' });
    } else {
      seenProv.add(prov.id);
    }
    if (!prov.baseURL) {
      errors.push({ scope: 'provider', key: prov._key, field: 'baseURL', message: 'Base URL is required' });
    } else {
      const ollamaLike = prov._templateId === 'ollama' || prov.name?.toLowerCase().includes('ollama');
      if (ollamaLike && (prov.baseURL === 'http://localhost:11434' || prov.baseURL === 'http://localhost:11434/')) {
        warnings.push({
          scope: 'provider', key: prov._key, field: 'baseURL',
          message: "Ollama's endpoint path is `/v1` — did you mean `http://localhost:11434/v1`?",
          fix: { field: 'baseURL', value: 'http://localhost:11434/v1' },
        });
      }
    }
    if (prov.models.length === 0) {
      warnings.push({ scope: 'provider', key: prov._key, message: 'Provider has no models' });
    } else if (prov.models.every(m => !m.tools)) {
      warnings.push({ scope: 'provider', key: prov._key, message: '`tools: false` on all models — agentic actions may not work' });
    }
    const seenModel = new Set();
    for (const m of prov.models) {
      if (!m.id) {
        errors.push({ scope: 'model', provKey: prov._key, key: m._key, field: 'id', message: 'Model ID is required' });
      } else if (seenModel.has(m.id)) {
        errors.push({ scope: 'model', provKey: prov._key, key: m._key, field: 'id', message: 'Model ID already used in this provider' });
      } else {
        seenModel.add(m.id);
      }
    }
  }
  return { errors, warnings };
}

function getModelHint(provider) {
  const t = TEMPLATES.find(t => t.id === provider._templateId);
  return t?.modelHint || null;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState = { providers: [], defaultModel: null, _unknownFields: {} };

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return action.payload;
    case 'RESET': return { ...initialState };
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
      if (old && defaultModel?.startsWith(old.id + '/')) defaultModel = null;
      return { ...state, providers, defaultModel };
    }
    case 'REORDER_PROVIDERS':
      return { ...state, providers: action.payload };
    case 'ADD_MODEL': {
      const { provKey, model, atIndex } = action.payload;
      return {
        ...state,
        providers: state.providers.map(p => {
          if (p._key !== provKey) return p;
          const models = [...p.models];
          if (atIndex !== undefined) models.splice(atIndex, 0, model);
          else models.push(model);
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
      if (prov && m && defaultModel === `${prov.id}/${m.id}`) defaultModel = null;
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
    default: return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ─── Small Components ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`toggle-track relative inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span className={`toggle-thumb inline-block h-3.5 w-3.5 rounded-full bg-white shadow ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Tooltip({ text, children }) {
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

function InfoIcon({ tip }) {
  return (
    <Tooltip text={tip}>
      <svg className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
      </svg>
    </Tooltip>
  );
}

function Badge({ type, children }) {
  const styles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${styles[type]}`}>
      {children}
    </span>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
      {msg}
    </p>
  );
}

function FieldWarning({ msg, onFix }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
      <span>{msg}</span>
      {onFix && <button onClick={onFix} className="ml-1 underline font-medium hover:text-amber-800">Fix it</button>}
    </p>
  );
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto fade-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="modal-title" className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Base URL Editor ─────────────────────────────────────────────────────────

function BaseURLEditor({ value, onChange, providerKey, isDocker }) {
  const { validation } = useApp();
  const err = validation.errors.find(e => e.key === providerKey && e.field === 'baseURL');
  const warn = validation.warnings.find(w => w.key === providerKey && w.field === 'baseURL');
  const parts = useMemo(() => parseURL(value || ''), [value]);

  const update = (field, val) => {
    const next = { ...parts, [field]: field === 'port' ? (parseInt(val) || 0) : val };
    onChange(buildURL(next.protocol, next.host, next.port, next.path));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">Base URL</label>
      <div className="flex items-center gap-1 flex-wrap">
        <select
          value={parts.protocol}
          onChange={e => update('protocol', e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="http">http://</option>
          <option value="https">https://</option>
        </select>
        <input
          value={parts.host}
          onChange={e => update('host', e.target.value)}
          placeholder="localhost"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
        />
        <span className="text-slate-400 text-sm">:</span>
        <input
          type="number"
          value={parts.port}
          onChange={e => update('port', e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
        />
        <input
          value={parts.path}
          onChange={e => update('path', e.target.value)}
          placeholder="/v1"
          className={`rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-24 ${isDocker ? 'bg-indigo-50' : ''}`}
        />
        {isDocker && <InfoIcon tip="Docker Model Runner appends /engines/v1 to the base URL — this is pre-filled for you." />}
      </div>
      <p className="mt-1 font-mono text-xs text-slate-400 break-all">{value || 'http://localhost:8080/v1'}</p>
      {err && <FieldError msg={err.message} />}
      {warn && <FieldWarning msg={warn.message} onFix={warn.fix ? () => onChange(warn.fix.value) : undefined} />}
    </div>
  );
}

// ─── Model Row ───────────────────────────────────────────────────────────────

function ModelRow({ model, provider, index, onDelete }) {
  const { dispatch, validation, pendingDeletes, undoDelete } = useApp();
  const pendingKey = `${provider._key}:${model._key}`;
  const isPending = !!pendingDeletes[pendingKey];
  const hint = getModelHint(provider);
  const idErr = validation.errors.find(e => e.key === model._key && e.field === 'id');
  const dragRef = useRef(null);

  const update = (field, val) =>
    dispatch({ type: 'UPDATE_MODEL', payload: { provKey: provider._key, key: model._key, updates: { [field]: val } } });

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${provider._key}|${index}`);
    dragRef.current = index;
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const [pk, fromIdx] = data.split('|');
    if (pk !== provider._key) return;
    const from = parseInt(fromIdx);
    if (from === index) return;
    const models = [...provider.models];
    const [moved] = models.splice(from, 1);
    models.splice(index, 0, moved);
    dispatch({ type: 'REORDER_MODELS', payload: { provKey: provider._key, models } });
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

// ─── Provider Card ───────────────────────────────────────────────────────────

function ProviderCard({ provider, index }) {
  const { dispatch, validation, deleteModel } = useApp();
  const [showAll, setShowAll] = useState(false);

  const idErr = validation.errors.find(e => e.key === provider._key && e.field === 'id');
  const provWarn = validation.warnings.filter(w => w.key === provider._key && !w.field);

  const update = (field, val) =>
    dispatch({ type: 'UPDATE_PROVIDER', payload: { key: provider._key, updates: { [field]: val } } });

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

// ─── Add Provider Modal ───────────────────────────────────────────────────────

function AddProviderModal({ onClose }) {
  const { dispatch, state } = useApp();
  const [selected, setSelected] = useState(null);

  const handleAdd = () => {
    const template = TEMPLATES.find(t => t.id === selected);
    if (!template) return;
    const existingIds = state.providers.map(p => p.id);
    let id = template.defaultProviderId;
    if (existingIds.includes(id)) {
      let n = 2;
      while (existingIds.includes(`${id}-${n}`)) n++;
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

// ─── Import Modal ────────────────────────────────────────────────────────────

function ImportModal({ onClose }) {
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
    if (!file) return;
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

// ─── JSON Preview ─────────────────────────────────────────────────────────────

function JSONPreview({ json, onToggle }) {
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

// ─── Default Model Selector ───────────────────────────────────────────────────

function DefaultModelSelector() {
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAddProvider, onImport }) {
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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ onNew, onImport, onAddProvider, onExport, exportDisabled, exportDisabledReason }) {
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

// ─── Toast Container ──────────────────────────────────────────────────────────

function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <div key={t.id} className={`slide-up flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white max-w-xs ${t.type === 'error' ? 'bg-red-600' : t.type === 'warning' ? 'bg-amber-600' : 'bg-slate-800'}`}>
          <span className="flex-1">{t.message}</span>
          {t.onUndo && (
            <button onClick={t.onUndo} className="text-xs underline opacity-80 hover:opacity-100 flex-shrink-0">Undo</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Resume Modal ─────────────────────────────────────────────────────────────

function ResumeModal({ onResume, onFresh }) {
  return (
    <Modal title="Resume previous session?" onClose={onFresh}>
      <p className="text-sm text-slate-600 mb-6">You have a saved config from a previous session. Would you like to continue where you left off?</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onFresh} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Start fresh</button>
        <button onClick={onResume} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Resume session</button>
      </div>
    </Modal>
  );
}

// ─── Provider List ────────────────────────────────────────────────────────────

function ProviderList({ providers }) {
  const { dispatch } = useApp();

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('provider'));
    if (isNaN(fromIndex) || fromIndex === toIndex) return;
    const reordered = [...providers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    dispatch({ type: 'REORDER_PROVIDERS', payload: reordered });
  };

  return (
    <div className="space-y-4">
      {providers.map((p, i) => (
        <div
          key={p._key}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('provider-drag-over'); e.currentTarget.style.borderRadius = '12px'; }}
          onDragLeave={e => { e.currentTarget.classList.remove('provider-drag-over'); e.currentTarget.style.borderRadius = ''; }}
          onDrop={e => { e.currentTarget.classList.remove('provider-drag-over'); handleDrop(e, i); }}
        >
          <ProviderCard provider={p} index={i} />
        </div>
      ))}
    </div>
  );
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
      if (saved) { savedRef.current = JSON.parse(saved); setShowResume(true); }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
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
      if (!entry) return prev;
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
    if (state.providers.length > 0 && !window.confirm('Start over? This will clear the current config.')) return;
    dispatch({ type: 'RESET' });
    try { localStorage.removeItem(LS_KEY); } catch {}
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
