import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Minimize2, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useBackendSettings } from '../hooks/useBackendSettings';
import { useAgentChat } from '../hooks/useAgentChat';
import { ChatMessage } from './ChatMessage';
import { Feedback } from './MessageFeedback';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';
import { AccessibilityPanel } from './AccessibilityPanel';
import { StreamingIndicator } from './StreamingIndicator';

interface ChatWidgetProps {
  /**
   * Position of the widget on the screen
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  
  /**
   * Primary color for the widget (overrides default turquoise)
   */
  primaryColor?: string;
  
  /**
   * Initial open state
   * @default false
   */
  defaultOpen?: boolean;
  
  /**
   * Custom welcome message
   */
  customWelcomeMessage?: string;
  
  /**
   * Custom widget title
   */
  title?: string;
  
  /**
   * Theme preference ('light' | 'dark' | 'auto')
   * @default 'auto'
   */
  themeMode?: 'light' | 'dark' | 'auto';
  
  /**
   * z-index for the widget
   * @default 1000
   */
  zIndex?: number;
}

export function ChatWidget({
  position = 'bottom-right',
  primaryColor,
  defaultOpen = false,
  title,
  themeMode = 'auto',
  zIndex = 1000,
}: ChatWidgetProps) {
  const { t, language } = useLanguage();
  const { selectedLLM } = useBackendSettings();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (themeMode === 'auto') {
      const saved = localStorage.getItem('vecinita-widget-theme');
      return (saved as 'light' | 'dark') || 'light';
    }
    return themeMode;
  });
  const [input, setInput] = useState('');
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use agent chat hook with conversation storage
  const {
    messages,
    isLoading,
    streamingMessage,
    progressMessages,
    streamProgress,
    pendingClarification,
    error,
    sendMessage,
    retryLastMessage,
  } = useAgentChat({
    language: language as 'en' | 'es',
    provider: selectedLLM?.provider,
    model: selectedLLM?.model,
    onError: (err) => {
      console.error('Agent error:', err);
    },
  });

  // Save theme to localStorage
  useEffect(() => {
    if (themeMode === 'auto') {
      localStorage.setItem('vecinita-widget-theme', theme);
    }
  }, [theme, themeMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input;
    setInput('');

    try {
      await sendMessage(userInput);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Error is handled by useAgentChat hook
    }
  };

  const handleFeedbackSubmit = (feedback: Feedback) => {
    // Store feedback in localStorage
    const storedFeedback = localStorage.getItem('vecinita_widget_feedback');
    const feedbackData = storedFeedback ? JSON.parse(storedFeedback) : {};
    feedbackData[feedback.messageId] = {
      rating: feedback.rating,
      comment: feedback.comment,
      timestamp: feedback.timestamp.toISOString(),
    };
    localStorage.setItem('vecinita_widget_feedback', JSON.stringify(feedbackData));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleRetry = () => {
    retryLastMessage();
  };

  // Position styles
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  const widgetTitle = title || t('appTitle');

  // Apply custom primary color if provided
  useEffect(() => {
    if (primaryColor && isOpen) {
      document.documentElement.style.setProperty('--widget-primary', primaryColor);
    }
  }, [primaryColor, isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses[position]} w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/50`}
        style={{ 
          backgroundColor: primaryColor || '#4DB8B8',
          zIndex,
        }}
        aria-label={t('newChat')}
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed ${positionClasses[position]} flex flex-col shadow-2xl rounded-lg overflow-hidden border border-border transition-all ${
          isMinimized ? 'h-14' : 'h-[600px]'
        } w-[400px] max-w-[calc(100vw-2rem)]`}
        style={{ zIndex }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b border-border"
          style={{ 
            backgroundColor: primaryColor || '#4DB8B8',
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageSquare className="w-5 h-5 text-white shrink-0" />
            <h2 className="text-white font-medium text-sm truncate">{widgetTitle}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsAccessibilityOpen(true)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={t('accessibility')}
              title={t('accessibility')}
            >
              <SettingsIcon className="w-4 h-4 text-white" />
            </button>
            <LanguageSelector variant="compact" />
            <ThemeToggle theme={theme} setTheme={setTheme} variant="compact" />
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Minimize2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={t('close')}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Messages */}
            <div className={`flex-1 overflow-y-auto bg-background ${theme === 'dark' ? 'dark' : ''}`}>
              <div className="max-w-full">
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message} 
                    onFeedbackSubmit={handleFeedbackSubmit}
                  />
                ))}
                {streamingMessage && (
                  <StreamingIndicator message={streamingMessage} />
                )}
                {pendingClarification && (
                  <div className="mx-3 mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      Action required
                    </p>
                    <p className="text-xs text-foreground">{pendingClarification.prompt}</p>
                    {pendingClarification.questions.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {pendingClarification.questions.map((question, index) => (
                          <li key={`${index}-${question}`}>{index + 1}. {question}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {isLoading && progressMessages.length > 0 && (
                  <div className="mx-3 mb-3 rounded-md border bg-muted/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {streamProgress.stage} · {streamProgress.percent}%
                      </p>
                      {streamProgress.waiting && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Waiting
                        </span>
                      )}
                    </div>
                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary transition-all"
                        style={{ width: `${streamProgress.percent}%` }}
                      />
                    </div>
                    <ul className="space-y-1">
                      {progressMessages.slice(-4).map((item, index) => (
                        <li key={`${index}-${item}`} className="text-xs text-muted-foreground">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {error && (
                  <div className="p-4 m-3 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-2">
                      {t('error.title')}
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">{error.message}</p>
                    <button
                      onClick={handleRetry}
                      className="text-sm text-primary hover:underline flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t('error.retry')}
                    </button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card p-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('typePlaceholder')}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  rows={1}
                  disabled={isLoading}
                  aria-label={t('typePlaceholder')}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-3 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  style={{ 
                    backgroundColor: primaryColor || '#4DB8B8',
                    color: 'white',
                  }}
                  aria-label={t('sendMessage')}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Accessibility Panel */}
      {isAccessibilityOpen && (
        <div style={{ zIndex: zIndex + 10 }}>
          <AccessibilityPanel isOpen={isAccessibilityOpen} onClose={() => setIsAccessibilityOpen(false)} />
        </div>
      )}
    </>
  );
}
