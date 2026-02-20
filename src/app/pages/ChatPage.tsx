/**
 * ChatPage — full-page chat experience plus floating widget.
 * This is the "/" route.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useBackendSettings } from '../hooks/useBackendSettings';
import { useAgentChat } from '../hooks/useAgentChat';
import { ChatMessage } from '../components/ChatMessage';
import { StreamingIndicator } from '../components/StreamingIndicator';
import { ChatWidget } from '../components/ChatWidget';

export default function ChatPage() {
  const { t, language } = useLanguage();
  const { selectedLLM } = useBackendSettings();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    streamingMessage,
    progressMessages,
    streamProgress,
    pendingClarification,
    error,
    sendMessage,
    clearThread,
    retryLastMessage,
  } = useAgentChat({
    language: language as 'en' | 'es',
    provider: selectedLLM?.provider,
    model: selectedLLM?.model,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    const question = input;
    setInput('');
    await sendMessage(question);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('appTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('appSubtitle')}</p>
        </div>
        <button
          onClick={() => clearThread()}
          className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
          type="button"
        >
          {t('newChat')}
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-3 h-6 w-6" />
              <p className="text-sm">{t('welcomeMessage')}</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {streamingMessage && <StreamingIndicator message={streamingMessage} />}
          {pendingClarification && (
            <div className="mx-4 mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Action required
              </p>
              <p className="text-sm text-foreground">{pendingClarification.prompt}</p>
              {pendingClarification.questions.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {pendingClarification.questions.map((question, index) => (
                    <li key={`${index}-${question}`}>{index + 1}. {question}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {isLoading && progressMessages.length > 0 && (
            <div className="mx-4 mb-3 rounded-md border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {streamProgress.stage} · {streamProgress.percent}%
                </p>
                {streamProgress.waiting && (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Waiting
                  </span>
                )}
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary transition-all"
                  style={{ width: `${streamProgress.percent}%` }}
                />
              </div>
              <ul className="space-y-1">
                {progressMessages.slice(-5).map((item, index) => (
                  <li key={`${index}-${item}`} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="m-4 rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="mb-2 text-sm font-medium text-destructive">{t('error.title')}</p>
              <p className="mb-3 text-sm text-muted-foreground">{error.message}</p>
              <button
                onClick={() => retryLastMessage()}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                {t('error.retry')}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-background p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('typePlaceholder')}
              className="min-h-[42px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
              aria-label={t('sendMessage')}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <ChatWidget defaultOpen={false} zIndex={1300} />
    </main>
  );
}
