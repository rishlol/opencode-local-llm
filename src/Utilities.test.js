import { describe, it, expect } from 'bun:test';
import { buildURL, parseURL, makeProvider, serializeConfig, parseConfig, validate } from './Utilities.js';
import { TEMPLATES, SCHEMA_URL } from './Constants.js';

// ─── buildURL ─────────────────────────────────────────────────────────────────

describe('buildURL', () => {
  it('builds a basic http URL', () => {
    expect(buildURL('http', 'localhost', 11434, '/v1')).toBe('http://localhost:11434/v1');
  });

  it('builds an https URL', () => {
    expect(buildURL('https', 'example.com', 443, '/api')).toBe('https://example.com:443/api');
  });

  it('defaults path to / when falsy', () => {
    expect(buildURL('http', 'localhost', 8080, '')).toBe('http://localhost:8080/');
    expect(buildURL('http', 'localhost', 8080, null)).toBe('http://localhost:8080/');
  });
});

// ─── parseURL ─────────────────────────────────────────────────────────────────

describe('parseURL', () => {
  it('parses a full http URL with path', () => {
    const result = parseURL('http://localhost:11434/v1');
    expect(result).toEqual({ protocol: 'http', host: 'localhost', port: 11434, path: '/v1' });
  });

  it('parses an https URL', () => {
    const result = parseURL('https://api.example.com:8443/path');
    expect(result).toEqual({ protocol: 'https', host: 'api.example.com', port: 8443, path: '/path' });
  });

  it('defaults http port to 80 when omitted', () => {
    const result = parseURL('http://example.com/v1');
    expect(result.port).toBe(80);
  });

  it('defaults https port to 443 when omitted', () => {
    const result = parseURL('https://example.com/v1');
    expect(result.port).toBe(443);
  });

  it('defaults path to / when omitted', () => {
    const result = parseURL('http://localhost:8080');
    expect(result.path).toBe('/');
  });

  it('returns fallback object for invalid URL', () => {
    const result = parseURL('not-a-url');
    expect(result).toEqual({ protocol: 'http', host: 'localhost', port: 8080, path: '/v1' });
  });
});

// ─── makeProvider ─────────────────────────────────────────────────────────────

describe('makeProvider', () => {
  const ollamaTemplate = TEMPLATES.find(t => t.id === 'ollama');
  const lmstudioTemplate = TEMPLATES.find(t => t.id === 'lmstudio');
  const dockerTemplate = TEMPLATES.find(t => t.id === 'docker');

  it('creates a provider from the Ollama template', () => {
    const p = makeProvider(ollamaTemplate);
    expect(p.id).toBe('ollama');
    expect(p.name).toBe('Ollama');
    expect(p.baseURL).toBe('http://localhost:11434/v1');
    expect(p.npm).toBe('@ai-sdk/openai-compatible');
    expect(p.models).toHaveLength(1);
    expect(p.models[0].id).toBe('llama3.2');
    expect(p.models[0].tools).toBe(true);
    expect(p._collapsed).toBe(false);
    expect(p._templateId).toBe('ollama');
  });

  it('uses overrideId when provided', () => {
    const p = makeProvider(ollamaTemplate, 'my-ollama');
    expect(p.id).toBe('my-ollama');
  });

  it('creates provider with no sample models when sampleModelId is null', () => {
    const p = makeProvider(lmstudioTemplate);
    expect(p.models).toHaveLength(0);
  });

  it('includes apiKey from template (Docker)', () => {
    const p = makeProvider(dockerTemplate);
    expect(p.apiKey).toBe('docker');
  });

  it('includes a unique _key per provider', () => {
    const p1 = makeProvider(ollamaTemplate);
    const p2 = makeProvider(ollamaTemplate);
    expect(p1._key).not.toBe(p2._key);
  });
});

// ─── serializeConfig ──────────────────────────────────────────────────────────

describe('serializeConfig', () => {
  const baseState = {
    defaultModel: null,
    _unknownFields: {},
    providers: [],
  };

  it('always includes $schema', () => {
    const json = serializeConfig(baseState);
    expect(JSON.parse(json).$schema).toBe(SCHEMA_URL);
  });

  it('omits top-level model field when defaultModel is null', () => {
    const json = serializeConfig(baseState);
    expect(JSON.parse(json)).not.toHaveProperty('model');
  });

  it('includes top-level model field when defaultModel is set', () => {
    const state = { ...baseState, defaultModel: 'ollama/llama3.2' };
    const json = serializeConfig(state);
    expect(JSON.parse(json).model).toBe('ollama/llama3.2');
  });

  it('serializes a provider with baseURL and models', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: 'ollama', name: 'Ollama',
        npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:11434/v1',
        apiKey: '',
        models: [{ _key: 'm1', id: 'llama3.2', name: '', tools: true, _unknownFields: {} }],
        _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(out.provider.ollama).toBeDefined();
    expect(out.provider.ollama.options.baseURL).toBe('http://localhost:11434/v1');
    expect(out.provider.ollama.models['llama3.2'].tools).toBe(true);
  });

  it('omits apiKey from options when empty', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: 'test', name: '', npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:8080/v1', apiKey: '',
        models: [], _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(out.provider.test.options).not.toHaveProperty('apiKey');
  });

  it('includes apiKey in options when present', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: 'docker', name: '', npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:12434/engines/v1', apiKey: 'docker',
        models: [], _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(out.provider.docker.options.apiKey).toBe('docker');
  });

  it('skips providers with no id', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: '', name: '', npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:8080/v1', apiKey: '', models: [], _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(Object.keys(out.provider)).toHaveLength(0);
  });

  it('skips models with no id', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: 'myprovider', name: '', npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:8080/v1', apiKey: '',
        models: [{ _key: 'm1', id: '', name: '', tools: false, _unknownFields: {} }],
        _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(Object.keys(out.provider.myprovider.models)).toHaveLength(0);
  });

  it('omits model name from output when empty string', () => {
    const state = {
      ...baseState,
      providers: [{
        _key: 'k1', id: 'p', name: '', npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:8080/v1', apiKey: '',
        models: [{ _key: 'm1', id: 'mymodel', name: '', tools: false, _unknownFields: {} }],
        _unknownFields: {},
      }],
    };
    const out = JSON.parse(serializeConfig(state));
    expect(out.provider.p.models.mymodel).not.toHaveProperty('name');
  });

  it('preserves unknown top-level fields', () => {
    const state = { ...baseState, _unknownFields: { customField: 42 } };
    const out = JSON.parse(serializeConfig(state));
    expect(out.customField).toBe(42);
  });

  it('output ends with a newline', () => {
    expect(serializeConfig(baseState).endsWith('\n')).toBe(true);
  });
});

// ─── parseConfig ──────────────────────────────────────────────────────────────

describe('parseConfig', () => {
  it('parses a minimal config', () => {
    const json = JSON.stringify({ $schema: SCHEMA_URL, provider: {} });
    const result = parseConfig(json);
    expect(result.providers).toHaveLength(0);
    expect(result.defaultModel).toBeNull();
  });

  it('parses the top-level model field', () => {
    const json = JSON.stringify({ $schema: SCHEMA_URL, model: 'ollama/llama3.2', provider: {} });
    const result = parseConfig(json);
    expect(result.defaultModel).toBe('ollama/llama3.2');
  });

  it('parses providers and models', () => {
    const json = JSON.stringify({
      $schema: SCHEMA_URL,
      provider: {
        ollama: {
          npm: '@ai-sdk/openai-compatible',
          name: 'Ollama',
          options: { baseURL: 'http://localhost:11434/v1' },
          models: { 'llama3.2': { tools: true, name: 'Llama 3.2' } },
        },
      },
    });
    const result = parseConfig(json);
    expect(result.providers).toHaveLength(1);
    const prov = result.providers[0];
    expect(prov.id).toBe('ollama');
    expect(prov.name).toBe('Ollama');
    expect(prov.baseURL).toBe('http://localhost:11434/v1');
    expect(prov.models).toHaveLength(1);
    expect(prov.models[0].id).toBe('llama3.2');
    expect(prov.models[0].tools).toBe(true);
    expect(prov.models[0].name).toBe('Llama 3.2');
  });

  it('defaults tools to false when not set', () => {
    const json = JSON.stringify({
      $schema: SCHEMA_URL,
      provider: {
        p: { options: { baseURL: 'http://localhost:8080/v1' }, models: { m: {} } },
      },
    });
    const result = parseConfig(json);
    expect(result.providers[0].models[0].tools).toBe(false);
  });

  it('collects unknown top-level fields', () => {
    const json = JSON.stringify({ $schema: SCHEMA_URL, provider: {}, myExtra: 'hello' });
    const result = parseConfig(json);
    expect(result._unknownFields.myExtra).toBe('hello');
  });

  it('collects unknown provider-level fields', () => {
    const json = JSON.stringify({
      $schema: SCHEMA_URL,
      provider: {
        p: { options: { baseURL: 'http://localhost:8080/v1' }, models: {}, customProp: 99 },
      },
    });
    const result = parseConfig(json);
    expect(result.providers[0]._unknownFields.customProp).toBe(99);
  });

  it('round-trips through serializeConfig', () => {
    const original = {
      defaultModel: 'ollama/llama3.2',
      _unknownFields: {},
      providers: [{
        _key: 'k1', id: 'ollama', name: 'Ollama',
        npm: '@ai-sdk/openai-compatible',
        baseURL: 'http://localhost:11434/v1',
        apiKey: '',
        models: [{ _key: 'm1', id: 'llama3.2', name: 'Llama', tools: true, _unknownFields: {} }],
        _unknownFields: {},
      }],
    };
    const serialized = serializeConfig(original);
    const reparsed = parseConfig(serialized);
    expect(reparsed.defaultModel).toBe(original.defaultModel);
    expect(reparsed.providers[0].id).toBe('ollama');
    expect(reparsed.providers[0].baseURL).toBe('http://localhost:11434/v1');
    expect(reparsed.providers[0].models[0].id).toBe('llama3.2');
    expect(reparsed.providers[0].models[0].tools).toBe(true);
  });
});

// ─── validate ─────────────────────────────────────────────────────────────────

describe('validate', () => {
  const makeModel = (id = 'llama3.2', tools = true) => ({
    _key: Math.random().toString(36).slice(2), id, name: '', tools, _unknownFields: {},
  });

  const makeProviderState = (overrides = {}) => ({
    _key: 'k1', id: 'ollama', name: 'Ollama',
    npm: '@ai-sdk/openai-compatible',
    baseURL: 'http://localhost:11434/v1', apiKey: '',
    models: [makeModel()], _unknownFields: {}, _templateId: 'ollama',
    ...overrides,
  });

  it('returns no errors for a valid state', () => {
    const state = { providers: [makeProviderState()] };
    const { errors, warnings } = validate(state);
    expect(errors).toHaveLength(0);
  });

  it('errors when there are no providers', () => {
    const { errors } = validate({ providers: [] });
    expect(errors.some(e => e.scope === 'global')).toBe(true);
  });

  it('errors when provider id is missing', () => {
    const state = { providers: [makeProviderState({ id: '' })] };
    const { errors } = validate(state);
    expect(errors.some(e => e.field === 'id' && e.scope === 'provider')).toBe(true);
  });

  it('errors on duplicate provider ids', () => {
    const state = {
      providers: [
        makeProviderState({ _key: 'a', id: 'dup' }),
        makeProviderState({ _key: 'b', id: 'dup' }),
      ],
    };
    const { errors } = validate(state);
    expect(errors.filter(e => e.field === 'id' && e.scope === 'provider')).toHaveLength(1);
  });

  it('errors when baseURL is missing', () => {
    const state = { providers: [makeProviderState({ baseURL: '' })] };
    const { errors } = validate(state);
    expect(errors.some(e => e.field === 'baseURL')).toBe(true);
  });

  it('warns when provider has no models', () => {
    const state = { providers: [makeProviderState({ models: [] })] };
    const { warnings } = validate(state);
    expect(warnings.some(w => w.message.includes('no models'))).toBe(true);
  });

  it('warns when all models have tools: false', () => {
    const state = { providers: [makeProviderState({ models: [makeModel('m1', false)] })] };
    const { warnings } = validate(state);
    expect(warnings.some(w => w.message.includes('tools: false'))).toBe(true);
  });

  it('does not warn tools when at least one model has tools: true', () => {
    const state = {
      providers: [makeProviderState({ models: [makeModel('m1', false), makeModel('m2', true)] })],
    };
    const { warnings } = validate(state);
    expect(warnings.some(w => w.message.includes('tools: false'))).toBe(false);
  });

  it('errors when model id is missing', () => {
    const state = {
      providers: [makeProviderState({ models: [makeModel('')] })],
    };
    const { errors } = validate(state);
    expect(errors.some(e => e.scope === 'model' && e.field === 'id')).toBe(true);
  });

  it('errors on duplicate model ids within a provider', () => {
    const state = {
      providers: [makeProviderState({ models: [makeModel('dup'), makeModel('dup')] })],
    };
    const { errors } = validate(state);
    expect(errors.filter(e => e.scope === 'model' && e.field === 'id')).toHaveLength(1);
  });

  it('warns about Ollama missing /v1 path', () => {
    const state = {
      providers: [makeProviderState({ baseURL: 'http://localhost:11434' })],
    };
    const { warnings } = validate(state);
    expect(warnings.some(w => w.field === 'baseURL' && w.fix)).toBe(true);
    expect(warnings[0].fix?.value).toBe('http://localhost:11434/v1');
  });

  it('does not warn Ollama path when /v1 is already present', () => {
    const state = {
      providers: [makeProviderState({ baseURL: 'http://localhost:11434/v1' })],
    };
    const { warnings } = validate(state);
    expect(warnings.some(w => w.field === 'baseURL')).toBe(false);
  });
});
