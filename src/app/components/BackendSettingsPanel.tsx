import React from 'react';
import { X, Brain, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useBackendSettings } from '../context/BackendSettingsContext';

interface BackendSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackendSettingsPanel({ isOpen, onClose }: BackendSettingsPanelProps) {
  const { t } = useLanguage();
  const { settings, registry, isLoading, error, setLLMProvider, setLLMModel, setEmbeddingProvider, setEmbeddingModel, refetchRegistry } = useBackendSettings();

  if (!isOpen) return null;

  // Get available models for current provider
  const llmProviders = registry?.llmProviders || {};
  const embeddingProviders = registry?.embeddingProviders || {};
  const availableLLMModels = llmProviders[settings.llmProvider]?.models || [];
  const availableEmbeddingModels = embeddingProviders[settings.embeddingProvider]?.models || [];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l border-border shadow-xl z-50 overflow-y-auto"
        role="dialog"
        aria-labelledby="backend-settings-title"
        aria-modal="true"
      >
        <div className="sticky top-0 bg-card border-b border-border p-3 sm:p-4 z-10">
          <div className="flex items-center justify-between">
            <h2 id="backend-settings-title" className="text-base sm:text-lg text-foreground">
              {t('backendSettings')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={t('close')}
            >
              <X className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span className="text-sm">
                  {t('language') === 'Spanish' ? 'Cargando registro de modelos...' : 'Loading model registry...'}
                </span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm text-destructive font-medium">
                    {t('language') === 'Spanish' ? 'Error al cargar el registro' : 'Failed to load registry'}
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">{error}</p>
                  <button
                    onClick={refetchRegistry}
                    className="mt-3 px-3 py-1.5 text-xs bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
                  >
                    {t('language') === 'Spanish' ? 'Reintentar' : 'Retry'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Content - only show when loaded */}
          {!isLoading && !error && (
            <>
          {/* LLM Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm sm:text-base text-foreground font-semibold">{t('llmModel')}</h3>
            </div>
            
            {/* LLM Provider */}
            <div className="space-y-2">
              <label htmlFor="llm-provider-select" className="text-xs sm:text-sm text-muted-foreground">
                {t('llmProvider')}
              </label>
              <select
                id="llm-provider-select"
                value={settings.llmProvider}
                onChange={(e) => setLLMProvider(e.target.value as any)}
                className="w-full px-3 py-2 text-sm sm:text-base rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('llmProvider')}
              >
                {Object.entries(llmProviders).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.name}</option>
                ))}
              </select>
            </div>

            {/* LLM Model */}
            <div className="space-y-2">
              <label htmlFor="llm-model-select" className="text-xs sm:text-sm text-muted-foreground">
                {t('llmModel')}
              </label>
              <select
                id="llm-model-select"
                value={settings.llmModel}
                onChange={(e) => setLLMModel(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('llmModel')}
              >
                {availableLLMModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('llmModelDescription')}
              </p>
            </div>
          </div>

          {/* Embedding Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
              <h3 className="text-sm sm:text-base text-foreground font-semibold">{t('embeddingService')}</h3>
            </div>
            
            {/* Embedding Provider */}
            <div className="space-y-2">
              <label htmlFor="embedding-provider-select" className="text-xs sm:text-sm text-muted-foreground">
                {t('embeddingProvider')}
              </label>
              <select
                id="embedding-provider-select"
                value={settings.embeddingProvider}
                onChange={(e) => setEmbeddingProvider(e.target.value as any)}
                className="w-full px-3 py-2 text-sm sm:text-base rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('embeddingProvider')}
              >
                {Object.entries(embeddingProviders).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.name}</option>
                ))}
              </select>
            </div>

            {/* Embedding Model */}
            <div className="space-y-2">
              <label htmlFor="embedding-model-select" className="text-xs sm:text-sm text-muted-foreground">
                {t('embeddingService')}
              </label>
              <select
                id="embedding-model-select"
                value={settings.embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('embeddingService')}
              >
                {availableEmbeddingModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('embeddingServiceDescription')}
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('language') === 'Spanish' 
                ? 'Estas configuraciones determinan qué modelos se utilizarán para generar respuestas y procesar las búsquedas vectoriales. Los cambios se aplicarán a partir de la siguiente consulta.'
                : 'These settings determine which models will be used to generate responses and process vector searches. Changes will apply starting with the next query.'}
            </p>
          </div>

          {/* Keyboard Shortcut */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{t('closePanel')}</span>
              <kbd className="px-2 py-1 bg-muted rounded border border-border text-foreground">
                Esc
              </kbd>
            </div>
          </div>
        </>
          )}
        </div>
      </div>
    </>
  );
}