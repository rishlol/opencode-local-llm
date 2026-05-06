import { SCHEMA_URL, TEMPLATES } from './Constants'

// ─── Utilities ────────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 10);

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

export { buildURL, parseURL, makeProvider, serializeConfig, parseConfig, validate, getModelHint };
