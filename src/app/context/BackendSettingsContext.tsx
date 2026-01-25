import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchModelRegistry, ModelRegistryData, getDefaultLLM, getDefaultEmbedding } from '../services/modelRegistry';

interface BackendSettings {
  llmProvider: string;
  llmModel: string;
  embeddingProvider: string;
  embeddingModel: string;
}

interface BackendSettingsContextType {
  settings: BackendSettings;
  registry: ModelRegistryData | null;
  isLoading: boolean;
  error: string | null;
  setLLMProvider: (provider: string) => void;
  setLLMModel: (model: string) => void;
  setEmbeddingProvider: (provider: string) => void;
  setEmbeddingModel: (model: string) => void;
  refetchRegistry: () => Promise<void>;
}

const BackendSettingsContext = createContext<BackendSettingsContextType | undefined>(undefined);

export function BackendSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BackendSettings>(() => {
    // Default settings
    const defaultSettings: BackendSettings = {
      llmProvider: 'openai',
      llmModel: 'gpt-4',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-large',
    };

    // Load from localStorage
    const saved = localStorage.getItem('vecinita-backend-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that the parsed data has the required fields
        if (parsed.llmProvider && parsed.llmModel && parsed.embeddingProvider && parsed.embeddingModel) {
          return parsed;
        }
        // If invalid, return defaults
        return defaultSettings;
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const [registry, setRegistry] = useState<ModelRegistryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistry = async () => {
      try {
        const data = await fetchModelRegistry();
        setRegistry(data);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch model registry');
        setIsLoading(false);
      }
    };

    fetchRegistry();
  }, []);

  useEffect(() => {
    localStorage.setItem('vecinita-backend-settings', JSON.stringify(settings));
  }, [settings]);

  const setLLMProvider = (provider: string) => {
    // When provider changes, reset to first model of that provider
    const firstModel = registry?.llmProviders[provider]?.models[0] || 'gpt-4';
    setSettings((prev) => ({ ...prev, llmProvider: provider, llmModel: firstModel }));
  };

  const setLLMModel = (model: string) => {
    setSettings((prev) => ({ ...prev, llmModel: model }));
  };

  const setEmbeddingProvider = (provider: string) => {
    // When provider changes, reset to first model of that provider
    const firstModel = registry?.embeddingProviders[provider]?.models[0] || 'text-embedding-3-large';
    setSettings((prev) => ({ ...prev, embeddingProvider: provider, embeddingModel: firstModel }));
  };

  const setEmbeddingModel = (model: string) => {
    setSettings((prev) => ({ ...prev, embeddingModel: model }));
  };

  const refetchRegistry = async () => {
    try {
      const data = await fetchModelRegistry();
      setRegistry(data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch model registry');
      setIsLoading(false);
    }
  };

  return (
    <BackendSettingsContext.Provider value={{ settings, registry, isLoading, error, setLLMProvider, setLLMModel, setEmbeddingProvider, setEmbeddingModel, refetchRegistry }}>
      {children}
    </BackendSettingsContext.Provider>
  );
}

export function useBackendSettings() {
  const context = useContext(BackendSettingsContext);
  if (context === undefined) {
    throw new Error('useBackendSettings must be used within a BackendSettingsProvider');
  }
  return context;
}