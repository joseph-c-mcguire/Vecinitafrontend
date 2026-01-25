// Model Registry Service - fetches available LLM and Embedding models from backend

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

// Mock data - this will be replaced with actual Supabase call
const MOCK_REGISTRY: ModelRegistryData = {
  llmProviders: {
    openai: {
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
      name: 'Anthropic',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    },
    google: {
      name: 'Google',
      models: ['gemini-pro', 'gemini-pro-vision'],
    },
    meta: {
      name: 'Meta',
      models: ['llama-2-70b', 'llama-2-13b'],
    },
  },
  embeddingProviders: {
    openai: {
      name: 'OpenAI',
      models: ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002'],
    },
    cohere: {
      name: 'Cohere',
      models: ['embed-english-v3.0', 'embed-multilingual-v3.0', 'embed-english-light-v3.0'],
    },
    huggingface: {
      name: 'HuggingFace',
      models: ['sentence-transformers/all-MiniLM-L6-v2', 'BAAI/bge-large-en-v1.5'],
    },
    voyage: {
      name: 'Voyage AI',
      models: ['voyage-large-2', 'voyage-code-2', 'voyage-2'],
    },
  },
};

/**
 * Fetches the model registry from the backend
 * 
 * BACKEND IMPLEMENTATION REQUIRED:
 * 
 * 1. Create 'model_registry' table in Supabase:
 *    - llm_providers: JSONB column
 *    - embedding_providers: JSONB column
 *    - updated_at: TIMESTAMP
 *    - created_at: TIMESTAMP
 * 
 * 2. Set up Row Level Security (RLS):
 *    - Allow public SELECT (or restrict to authenticated users)
 *    - Only admins can UPDATE/INSERT
 * 
 * 3. Populate table with initial data matching ModelRegistryData structure
 * 
 * 4. Replace the code below with:
 *    ```typescript
 *    import { supabase } from '@/lib/supabase';
 *    
 *    export async function fetchModelRegistry(): Promise<ModelRegistryData> {
 *      const { data, error } = await supabase
 *        .from('model_registry')
 *        .select('llm_providers, embedding_providers')
 *        .order('created_at', { ascending: false })
 *        .limit(1)
 *        .single();
 *    
 *      if (error) {
 *        console.error('Error fetching model registry:', error);
 *        throw new Error('Failed to fetch model registry');
 *      }
 *    
 *      return {
 *        llmProviders: data.llm_providers,
 *        embeddingProviders: data.embedding_providers,
 *      };
 *    }
 *    ```
 * 
 * See /BACKEND_IMPLEMENTATION.md for complete details
 */
export async function fetchModelRegistry(): Promise<ModelRegistryData> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // TODO: Replace this mock implementation with actual Supabase call
  // Example:
  // const { data, error } = await supabase
  //   .from('model_registry')
  //   .select('*')
  //   .single();
  //
  // if (error) throw error;
  // return data;

  return MOCK_REGISTRY;
}

/**
 * Gets the default LLM provider and model from registry
 */
export function getDefaultLLM(registry: ModelRegistryData): { provider: string; model: string } {
  const firstProvider = Object.keys(registry.llmProviders)[0];
  const firstModel = registry.llmProviders[firstProvider]?.models[0];
  return {
    provider: firstProvider || 'openai',
    model: firstModel || 'gpt-4',
  };
}

/**
 * Gets the default embedding provider and model from registry
 */
export function getDefaultEmbedding(registry: ModelRegistryData): { provider: string; model: string } {
  const firstProvider = Object.keys(registry.embeddingProviders)[0];
  const firstModel = registry.embeddingProviders[firstProvider]?.models[0];
  return {
    provider: firstProvider || 'openai',
    model: firstModel || 'text-embedding-3-large',
  };
}