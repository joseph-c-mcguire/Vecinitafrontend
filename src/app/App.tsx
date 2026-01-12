import React, { useState, useRef, useEffect } from 'react';
import { Send, Home, MessageSquare, Settings } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ChatMessage, Message } from './components/ChatMessage';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSelector } from './components/LanguageSelector';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { Source } from './components/SourceCard';
import { fetchConfig, streamQuestion, getOrCreateThreadId, ConfigResponse, StreamEvent } from '../api/client';

function ChatInterface() {
  const { t, language } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load thread ID and provider/model config
  useEffect(() => {
    setThreadId(getOrCreateThreadId());

    const loadConfig = async () => {
      try {
        setIsLoadingConfig(true);
        setConfigError(null);
        const cfg = await fetchConfig();
        // Normalize in case backend shape differs
        const normalizedProviders = Array.isArray(cfg.providers)
          ? cfg.providers.map((p: any) => ({ id: p.id ?? p.key ?? String(p), name: p.name ?? p.label ?? String(p) }))
          : [];
        const normalizedModels = Array.isArray(cfg.models)
          ? cfg.models
          : (cfg as any).models && typeof (cfg as any).models === 'object'
            ? Object.entries((cfg as any).models).flatMap(([providerKey, arr]: [string, any]) =>
                (Array.isArray(arr) ? arr : []).map((modelId: any) => ({ id: String(modelId), provider: providerKey, name: String(modelId) }))
              )
            : [];
        const normCfg: ConfigResponse = { providers: normalizedProviders, models: normalizedModels };
        setConfig(normCfg);
        if (normCfg.providers.length > 0) {
          const provider = normCfg.providers[0].id;
          const model = normCfg.models.find(m => m.provider === provider)?.id || normCfg.models[0]?.id || '';
          setSelectedProvider(provider);
          setSelectedModel(model);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load configuration';
        setConfigError(msg);
        // Initialize defaults even if config fails, to avoid blocking UI
        setSelectedProvider(prev => prev || 'default');
        setSelectedModel(prev => prev || 'default');
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add or update welcome message when language changes
    if (messages.length === 0) {
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: t('welcomeMessage'),
          timestamp: new Date(),
        },
      ]);
    } else {
      // Update the welcome message if it's the first message
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === '0') {
          return [
            {
              ...prev[0],
              content: t('welcomeMessage'),
            },
            ...prev.slice(1),
          ];
        }
        return prev;
      });
    }
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !threadId || !selectedProvider || !selectedModel) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    const placeholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, placeholder]);

    try {
      let responseContent = '';
      let responseSources: Source[] = [];

      await streamQuestion(
        userMessage.content,
        language,
        selectedProvider,
        selectedModel,
        threadId,
        (event: StreamEvent) => {
          if (event.type === 'thinking') {
            // Optionally surface thinking messages in UI if desired
            return;
          }
          if (event.type === 'complete') {
            try {
              const data = JSON.parse(event.data);
              responseContent = data.answer || data.content || '';
              responseSources = data.sources || [];
            } catch {
              responseContent = event.data;
            }
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated.length - 1;
              if (last >= 0 && updated[last].id === assistantId) {
                updated[last] = { ...updated[last], content: responseContent, sources: responseSources };
              }
              return updated;
            });
          }
          if (event.type === 'clarification') {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated.length - 1;
              if (last >= 0 && updated[last].id === assistantId) {
                updated[last] = { ...updated[last], content: event.data };
              }
              return updated;
            });
          }
          if (event.type === 'error') {
            throw new Error(event.data);
          }
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (last >= 0 && updated[last].role === 'assistant') {
          updated[last] = { ...updated[last], content: `Error: ${msg}` };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content: t('welcomeMessage'),
        timestamp: new Date(),
      },
    ]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle ESC key to close accessibility panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccessibilityOpen) {
        setIsAccessibilityOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAccessibilityOpen]);

  // Cycle through thinking messages
  useEffect(() => {
    if (!isLoading) {
      setThinkingMessageIndex(0);
      return;
    }

    const thinkingMessages = t('thinkingMessages').split('|');
    const interval = setInterval(() => {
      setThinkingMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 800);

    return () => clearInterval(interval);
  }, [isLoading, language]);

  const getThinkingMessage = () => {
    const thinkingMessages = t('thinkingMessages').split('|');
    return thinkingMessages[thinkingMessageIndex] || thinkingMessages[0];
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Home className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl text-foreground truncate">{t('appTitle')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {t('appSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handleNewChat}
              className="p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
              aria-label={t('newChat')}
              title={t('newChat')}
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
              <span className="hidden md:inline text-foreground">{t('newChat')}</span>
            </button>
            <button
              onClick={() => setIsAccessibilityOpen(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={t('accessibility')}
              title={t('accessibility')}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
            </button>
            <LanguageSelector />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
        {/* Provider/Model selectors row */}
        <div className="container mx-auto px-2 sm:px-4 pb-2">
          {isLoadingConfig ? (
            <p className="text-xs text-muted-foreground">Loading configuration…</p>
          ) : configError ? (
            <p className="text-xs text-red-500">{configError}</p>
          ) : config ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t('provider') || 'Provider'}</label>
                <select
                  className="text-sm bg-background border border-border rounded px-2 py-1"
                  value={selectedProvider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setSelectedProvider(provider);
                    const nextModel = config.models.find(m => m.provider === provider)?.id || '';
                    setSelectedModel(nextModel);
                  }}
                >
                  {config.providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t('model') || 'Model'}</label>
                <select
                  className="text-sm bg-background border border-border rounded px-2 py-1"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {config.models
                    .filter((m) => m.provider === selectedProvider)
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.id}</option>
                    ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto" role="main">
        <div className="container mx-auto max-w-4xl px-0 sm:px-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/30" role="status" aria-live="polite">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-muted-foreground break-words">{getThinkingMessage()}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto max-w-4xl p-2 sm:p-4">
          <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
            <label htmlFor="message-input" className="sr-only">
              {t('typePlaceholder')}
            </label>
            <textarea
              ref={inputRef}
              id="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('typePlaceholder')}
              className="flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base"
              rows={1}
              disabled={isLoading}
              aria-label={t('typePlaceholder')}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              aria-label={t('sendMessage')}
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </button>
          </form>
          <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1.5 sm:mt-2 px-2">
            {(() => {
              if (isLoading) return language === 'es' ? 'Pensando… transmitiendo respuesta…' : 'Thinking… streaming response…';
              if (configError) return language === 'es' ? 'No se pudo cargar la configuración; usando valores por defecto.' : 'Could not load config; using defaults.';
              if (selectedProvider && selectedModel)
                return language === 'es'
                  ? `Conectado a ${selectedProvider} · Modelo ${selectedModel} · Hilo ${threadId?.slice(0, 8)}`
                  : `Connected to ${selectedProvider} · Model ${selectedModel} · Thread ${threadId?.slice(0, 8)}`;
              return language === 'es' ? 'Listo.' : 'Ready.';
            })()}
          </p>
        </div>
      </footer>

      {/* Accessibility Panel */}
      <AccessibilityPanel
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <ChatInterface />
      </AccessibilityProvider>
    </LanguageProvider>
  );
}