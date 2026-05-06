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

export { SCHEMA_URL, LS_KEY, TEMPLATES };
