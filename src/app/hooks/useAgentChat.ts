/**
 * Agent Chat Hook
 *
 * Integrates agent service API calls with local conversation storage.
 * Handles streaming responses, message state, and thread management.
 */

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { agentService, AgentServiceError } from '../services/agentService';
import { useConversationStorage, type Message } from './useConversationStorage';
import type {
  StreamEvent,
  AgentSource,
  AskQueryParams,
  AgentResponse,
} from '../types/agent';

interface UseAgentChatOptions {
  initialThreadId?: string;
  language?: 'en' | 'es';
  provider?: string;
  model?: string;
  onError?: (error: AgentServiceError) => void;
  service?: {
    askStream: (params: AskQueryParams, onEvent: (event: StreamEvent) => void) => Promise<void>;
    ask: (params: AskQueryParams) => Promise<AgentResponse>;
  };
}

interface StreamProgressState {
  stage: string;
  percent: number;
  waiting: boolean;
  status: 'working' | 'waiting' | 'error';
}

interface PendingClarificationState {
  originalQuestion: string;
  prompt: string;
  questions: string[];
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const locale: 'en' | 'es' = options.language === 'es' ? 'es' : 'en';
  const copy = {
    connecting: locale === 'es' ? 'Conectando con el backend...' : 'Connecting to backend...',
    generating: locale === 'es' ? 'Generando respuesta...' : 'Generating response...',
    clarificationNeeded: locale === 'es' ? 'Se necesita aclaración' : 'Clarification needed',
    toolSummaryTitle: locale === 'es' ? 'Resumen de herramientas' : 'Tool Summary',
    emptyResponse: locale === 'es'
      ? 'No pude generar una respuesta en este momento. Inténtalo de nuevo.'
      : 'I could not generate a response right now. Please try again.',
    unexpectedError: locale === 'es' ? 'Ocurrió un error inesperado' : 'An unexpected error occurred',
    encounteredErrorPrefix: locale === 'es' ? 'Lo siento, encontré un error:' : 'Sorry, I encountered an error:',
  };

  const serviceClient = options.service || agentService;
  const chatDebugEnabled =
    ((import.meta as ImportMeta).env?.VITE_AGENT_DEBUG === 'true')
    || (typeof window !== 'undefined' && window.localStorage.getItem('vecinita_debug_chat') === '1');

  const debugLog = (...args: unknown[]) => {
    if (!chatDebugEnabled) {
      return;
    }
    console.info('[useAgentChat]', ...args);
  };
  const [threadId, setThreadId] = useState<string>(
    options.initialThreadId || uuidv4()
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [error, setError] = useState<AgentServiceError | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [pendingClarification, setPendingClarification] = useState<PendingClarificationState | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgressState>({
    stage: 'Starting',
    percent: 0,
    waiting: false,
    status: 'working',
  });

  const storage = useConversationStorage(threadId);

  const appendProgressMessage = useCallback((message: string) => {
    const value = (message || '').trim();
    if (!value) {
      return;
    }
    setProgressMessages((current) => {
      const deduped = current[current.length - 1] === value ? current : [...current, value];
      return deduped.slice(-8);
    });
  }, []);

  const localizeStreamMessage = useCallback((message?: string) => {
    const raw = (message || '').trim();
    if (!raw || locale !== 'es') {
      return raw;
    }

    const exactMap: Record<string, string> = {
      'Checking if I already know this...': 'Verificando si ya conozco esto...',
      'Looking through our local resources...': 'Revisando nuestros recursos locales...',
      'I need a bit more information...': 'Necesito un poco mas de informacion...',
      'Searching for additional information...': 'Buscando informacion adicional...',
      'Let me think about your question...': 'Dejame pensar en tu pregunta...',
      'Understanding your question...': 'Entendiendo tu pregunta...',
      'Finding relevant information...': 'Encontrando informacion relevante...',
      'Finalizing answer...': 'Finalizando respuesta...',
      'User clarification is required.': 'Se requieren aclaraciones del usuario.',
      'Tool call completed.': 'Herramienta completada.',
      'I need more details to continue.': 'Necesito mas informacion para continuar.',
      'Service temporarily unavailable. Please try again in a moment.': 'Servicio temporalmente no disponible. Intentalo de nuevo en un momento.',
    };

    if (exactMap[raw]) {
      return exactMap[raw];
    }

    const dbSearchSummary = raw.match(/^db_search returned (\d+) relevant chunks\.$/i);
    if (dbSearchSummary) {
      return `db_search devolvio ${dbSearchSummary[1]} fragmentos relevantes.`;
    }

    const webSearchSummary = raw.match(/^web_search returned (\d+) web results\.$/i);
    if (webSearchSummary) {
      return `web_search devolvio ${webSearchSummary[1]} resultados web.`;
    }

    return raw;
  }, [locale]);

  const formatStageLabel = useCallback((stage?: string) => {
    if (!stage) {
      return 'Working';
    }
    const normalized = stage.trim().toLowerCase();
    if (!normalized) {
      return 'Working';
    }
    return normalized
      .split(/[_\s-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, []);

  /**
   * Load conversation history from localStorage on mount or thread change.
   */
  useEffect(() => {
    const loadedMessages = storage.loadMessages();
    if (loadedMessages) {
      setMessages(loadedMessages);
    }
  }, [threadId]); // storage.loadMessages is stable but we only load on threadId change

  /**
   * Convert agent sources to message sources format.
   */
  const mapSources = (agentSources: AgentSource[]) => {
    return agentSources.map((source) => ({
      title: source.title,
      url: source.url,
      snippet: source.metadata?.content as string | undefined,
    }));
  };

  /**
   * Send a message and get a streaming response.
   */
  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim()) return;

      setIsLoading(true);
      setError(null);
      setStreamingMessage(copy.connecting);
      setProgressMessages([]);
      setStreamProgress({
        stage: 'Connecting',
        percent: 5,
        waiting: true,
        status: 'waiting',
      });
      appendProgressMessage(`⏳ ${copy.connecting}`);

      // Create and add user message immediately
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };

      let workingMessages = [...messages, userMessage];
      setMessages(workingMessages);
      storage.saveMessages(workingMessages);

      const appendAssistantEventMessage = (content: string) => {
        const value = content.trim();
        if (!value) {
          return;
        }

        const eventMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: value,
          timestamp: new Date(),
        };

        workingMessages = [...workingMessages, eventMessage];
        setMessages(workingMessages);
        storage.saveMessages(workingMessages);
      };

      const activeClarification = pendingClarification;
      const requestParams: AskQueryParams = {
        question: activeClarification?.originalQuestion || question,
        thread_id: threadId,
        lang: options.language,
        provider: options.provider,
        model: options.model,
        clarification_response: activeClarification ? question : undefined,
      };

      try {
        debugLog('sendMessage:start', {
          question,
          threadId,
          hasPendingClarification: Boolean(activeClarification),
        });
        let assistantContent = '';
        let assistantSources: AgentSource[] = [];
        let newThreadId = threadId;
        const latestToolResults = new Map<string, string>();
        let streamEventCount = 0;
        let sawCompleteEvent = false;
        let sawClarificationEvent = false;

        const updateProgressFromEvent = (event: {
          stage?: string;
          progress?: number;
          waiting?: boolean;
          status?: 'working' | 'waiting' | 'error';
        }) => {
          setStreamProgress((current) => {
            const nextPercent = Math.max(0, Math.min(100, event.progress ?? current.percent));
            const nextStage = formatStageLabel(event.stage) || current.stage;
            const nextWaiting = Boolean(event.waiting);
            const nextStatus = event.status || (nextWaiting ? 'waiting' : 'working');

            return {
              stage: nextStage,
              percent: nextPercent,
              waiting: nextWaiting,
              status: nextStatus,
            };
          });
        };

        const formatToolLabel = (toolName: string) =>
          toolName
            .split(/[_\s-]+/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

        // Stream response from agent
        await serviceClient.askStream(
          requestParams,
          (event: StreamEvent) => {
            streamEventCount += 1;
            debugLog('stream:event', { type: event.type, count: streamEventCount });
            switch (event.type) {
              case 'thinking':
                setStreamingMessage(localizeStreamMessage(event.message));
                updateProgressFromEvent(event);
                appendProgressMessage(`• ${localizeStreamMessage(event.message)}`);
                break;

              case 'token':
                // Accumulate tokens as they stream in
                assistantContent += (event.content || '');
                // Update UI with streaming response
                setStreamingMessage(copy.generating);
                break;

              case 'source':
                // Add source as it's discovered
                if (event.url && event.title) {
                  assistantSources.push({
                    url: event.url,
                    title: event.title,
                    type: event.source_type || 'document',
                  } as AgentSource);
                }
                break;

              case 'complete':
                sawCompleteEvent = true;
                assistantContent = event.answer;
                assistantSources = event.sources || assistantSources;
                setPendingClarification(null);
                if (event.thread_id) {
                  newThreadId = event.thread_id;
                }
                // Store metadata for debugging (not shown to user)
                console.debug('Streaming complete. Metadata:', event.metadata);
                setStreamingMessage(null);
                setStreamProgress({
                  stage: 'Complete',
                  percent: event.metadata?.progress ?? 100,
                  waiting: false,
                  status: 'working',
                });
                break;

              case 'clarification':
                // Handle clarification requests
                {
                  sawClarificationEvent = true;
                  const clarificationMessage = localizeStreamMessage(event.message)
                    || (event.questions && event.questions.length > 0
                      ? event.questions.join(' ')
                      : 'Please provide more details so I can continue.');
                  const clarificationQuestions = (event.questions || event.suggestedQuestions || [])
                    .filter((value): value is string => Boolean(value && value.trim()))
                    .slice(0, 3);

                  const displayMessage = clarificationQuestions.length > 0
                    ? `${copy.clarificationNeeded}:\n${clarificationMessage}\n\n${clarificationQuestions.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}`
                    : `${copy.clarificationNeeded}: ${clarificationMessage}`;
                  setStreamingMessage(displayMessage);
                  appendProgressMessage(displayMessage);
                  updateProgressFromEvent({
                    stage: event.stage || 'clarification',
                    progress: event.progress ?? 85,
                    waiting: true,
                    status: 'waiting',
                  });
                  setPendingClarification({
                    originalQuestion: activeClarification?.originalQuestion || question,
                    prompt: clarificationMessage,
                    questions: clarificationQuestions,
                  });
                  appendAssistantEventMessage(displayMessage);
                }
                break;

              case 'error':
                updateProgressFromEvent({
                  stage: event.stage || 'error',
                  progress: event.progress ?? 100,
                  waiting: false,
                  status: 'error',
                });
                throw new AgentServiceError(
                  event.message,
                  undefined,
                  event.code
                );

              case 'tool_event':
                setStreamingMessage(localizeStreamMessage(event.message));
                updateProgressFromEvent(event);
                const localizedToolMessage = localizeStreamMessage(event.message);
                if (event.phase === 'start') {
                  appendProgressMessage(`⏳ ${localizedToolMessage}`);
                } else if (event.phase === 'result') {
                  appendProgressMessage(`✅ ${localizedToolMessage}`);
                } else {
                  appendProgressMessage(`⚠️ ${localizedToolMessage}`);
                }
                if (event.phase === 'result' && event.tool && event.message) {
                  latestToolResults.set(event.tool, localizedToolMessage);
                }
                break;
            }
          }
        );

        if (!assistantContent.trim() && !sawClarificationEvent) {
          console.warn('[useAgentChat] Stream finished without assistant content, attempting non-stream fallback', {
            question,
            threadId,
            streamEventCount,
            sawCompleteEvent,
          });

          const fallbackResponse = await serviceClient.ask(requestParams);
          assistantContent = fallbackResponse.answer || '';
          assistantSources = fallbackResponse.sources || assistantSources;
          if (fallbackResponse.thread_id) {
            newThreadId = fallbackResponse.thread_id;
          }

          debugLog('fallback:non_stream_after_empty_stream', {
            question,
            threadId,
            fallbackHasAnswer: Boolean(assistantContent.trim()),
          });
        }

        if (!assistantContent.trim() && !sawClarificationEvent) {
          assistantContent = copy.emptyResponse;
          debugLog('empty_response:using_default_assistant_message', {
            question,
            threadId,
            streamEventCount,
          });
        }

        if (latestToolResults.size > 0) {
          const toolSummary = Array.from(latestToolResults.entries())
            .map(([toolName, summary]) => `• ${formatToolLabel(toolName)}\n  ${summary}`)
            .join('\n');
          appendAssistantEventMessage(
            `${copy.toolSummaryTitle}\n────────────\n${toolSummary}`
          );
        }

        // Create assistant message when final answer exists
        let finalMessages = workingMessages;
        if (assistantContent.trim()) {
          const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: assistantContent,
            sources: mapSources(assistantSources),
            timestamp: new Date(),
          };
          finalMessages = [...finalMessages, assistantMessage];
          setMessages(finalMessages);
        }

        // Update thread ID if it changed
        if (newThreadId !== threadId) {
          setThreadId(newThreadId);
        }

        // Save to localStorage (will use updated threadId due to useEffect)
        storage.saveMessages(finalMessages);
        debugLog('sendMessage:success', {
          question,
          threadId,
          finalMessageCount: finalMessages.length,
        });
      } catch (err) {
        debugLog('sendMessage:stream_or_processing_error', {
          question,
          threadId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        let agentError =
          err instanceof AgentServiceError
            ? err
            : new AgentServiceError(copy.unexpectedError);

        try {
          const fallbackResponse = await serviceClient.ask(requestParams);
          let fallbackMessages = workingMessages;

          const fallbackAnswer = (fallbackResponse.answer || '').trim();
          if (fallbackAnswer) {
            const fallbackAssistantMessage: Message = {
              id: uuidv4(),
              role: 'assistant',
              content: fallbackAnswer,
              sources: mapSources(fallbackResponse.sources || []),
              timestamp: new Date(),
            };
            fallbackMessages = [...fallbackMessages, fallbackAssistantMessage];
            setMessages(fallbackMessages);
          } else {
            const fallbackAssistantMessage: Message = {
              id: uuidv4(),
              role: 'assistant',
              content: copy.emptyResponse,
              timestamp: new Date(),
            };
            fallbackMessages = [...fallbackMessages, fallbackAssistantMessage];
            setMessages(fallbackMessages);
          }

          if (fallbackResponse.thread_id && fallbackResponse.thread_id !== threadId) {
            setThreadId(fallbackResponse.thread_id);
          }

          setError(null);
          storage.saveMessages(fallbackMessages);
          debugLog('sendMessage:fallback_success', {
            question,
            threadId,
            fallbackMessageCount: fallbackMessages.length,
          });
          return;
        } catch (fallbackError) {
          debugLog('sendMessage:fallback_failed', {
            question,
            threadId,
            error: fallbackError instanceof Error ? fallbackError.message : 'unknown',
          });
          agentError =
            fallbackError instanceof AgentServiceError
              ? fallbackError
              : new AgentServiceError(copy.unexpectedError);
        }

        setError(agentError);
        if (options.onError) {
          options.onError(agentError);
        }

        // Add error message to chat
        const errorMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `${copy.encounteredErrorPrefix} ${agentError.message}`,
          timestamp: new Date(),
        };

        const finalMessages = [...workingMessages, errorMessage];
        setMessages(finalMessages);
        storage.saveMessages(finalMessages);
      } finally {
        setIsLoading(false);
        setStreamingMessage(null);
        setStreamProgress((current) => ({
          ...current,
          waiting: false,
          percent: current.status === 'error' ? current.percent : Math.max(current.percent, 100),
        }));
      }
    },
    [
      messages,
      threadId,
      storage,
      appendProgressMessage,
      formatStageLabel,
      localizeStreamMessage,
      pendingClarification,
      options.language,
      options.provider,
      options.model,
      serviceClient,
      options.onError,
      copy.clarificationNeeded,
      copy.connecting,
      copy.emptyResponse,
      copy.encounteredErrorPrefix,
      copy.generating,
      copy.toolSummaryTitle,
      copy.unexpectedError,
    ]
  );

  /**
   * Load an existing thread by ID.
   */
  const loadThread = useCallback(
    (newThreadId: string) => {
      setThreadId(newThreadId);
      // Messages will be loaded by useEffect
    },
    []
  );

  /**
   * Start a completely new conversation — new thread ID, clear messages.
   * Never calls any API or Supabase. Everything stays in localStorage.
   */
  const startNewConversation = useCallback(() => {
    storage.deleteThread();
    setMessages([]);
    setThreadId(uuidv4());
    setError(null);
    setStreamingMessage(null);
  }, [storage]);

  /**
   * Clear the current thread and start fresh.
   * Alias for startNewConversation for backward compat.
   */
  const clearThread = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  /**
   * Retry the last message (useful after errors).
   */
  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === 'user');

    if (lastUserMessage) {
      // Remove last assistant message if it was an error
      const filteredMessages = messages.slice(0, -1);
      setMessages(filteredMessages);
      storage.saveMessages(filteredMessages);

      // Resend the question
      sendMessage(lastUserMessage.content);
    }
  }, [messages, storage, sendMessage]);

  return {
    threadId,
    messages,
    isLoading,
    streamingMessage,
    error,
    progressMessages,
    streamProgress,
    pendingClarification,
    sendMessage,
    loadThread,
    clearThread,
    startNewConversation,
    retryLastMessage,
    getAllThreadIds: storage.getAllThreadIds,
    getTimeRemaining: storage.getTimeRemaining,
  };
}
