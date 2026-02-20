// Model Registry Service - fetches available LLM and embedding models from backend services

const API_BASE =
  import.meta.env.VITE_GATEWAY_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8004/api/v1');

export interface ModelRegistryData {
  llmProviders: {
    [key: string]: {
      name: string;
      models: string[];
    };
  };
  embeddingProviders: {
    [key: string]: {
      name: string;
      models: string[];
    };
  };
}

interface AskConfigResponse {
  providers: Array<{ key: string; label: string }>;
  models: Record<string, string[]>;
}

interface EmbedConfigResponse {
  current?: { provider?: string; model?: string };
  available?: {
    providers?: Array<{ key: string; label: string }>;
    models?: Record<string, string[]>;
  };
}

function toProviderMap(
  providers: Array<{ key: string; label: string }> = [],
  modelsByProvider: Record<string, string[]> = {},
): Record<string, { name: string; models: string[] }> {
  return providers.reduce((acc, provider) => {
    acc[provider.key] = {
      name: provider.label,
      models: modelsByProvider[provider.key] ?? [],
    };
    return acc;
  }, {} as Record<string, { name: string; models: string[] }>);
}

export async function fetchModelRegistry(): Promise<ModelRegistryData> {
  const [askRes, embedRes] = await Promise.all([
    fetch(`${API_BASE}/ask/config`),
    fetch(`${API_BASE}/embed/config`),
  ]);

  if (!askRes.ok) {
    throw new Error(`Failed to fetch LLM providers (HTTP ${askRes.status})`);
  }
  if (!embedRes.ok) {
    throw new Error(`Failed to fetch embedding providers (HTTP ${embedRes.status})`);
  }

  const askData = (await askRes.json()) as AskConfigResponse;
  const embedData = (await embedRes.json()) as EmbedConfigResponse;

  const llmProviders = toProviderMap(askData.providers, askData.models);
  const embeddingProviders = toProviderMap(
    embedData.available?.providers ?? [],
    embedData.available?.models ?? {},
  );

  return {
    llmProviders,
    embeddingProviders,
  };
}

export function getDefaultLLM(registry: ModelRegistryData): { provider: string; model: string } {
  const firstProvider = Object.keys(registry.llmProviders)[0];
  const firstModel = registry.llmProviders[firstProvider]?.models[0];
  return {
    provider: firstProvider || 'ollama',
    model: firstModel || 'llama3.1:8b',
  };
}

export function getDefaultEmbedding(registry: ModelRegistryData): { provider: string; model: string } {
  const firstProvider = Object.keys(registry.embeddingProviders)[0];
  const firstModel = registry.embeddingProviders[firstProvider]?.models[0];
  return {
    provider: firstProvider || 'huggingface',
    model: firstModel || 'sentence-transformers/all-MiniLM-L6-v2',
  };
}
