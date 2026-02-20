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
import type { StreamEvent, AgentSource } from '../types/agent';

interface UseAgentChatOptions {
  initialThreadId?: string;
  language?: 'en' | 'es';
  provider?: string;
  model?: string;
  onError?: (error: AgentServiceError) => void;
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
      setStreamingMessage('Connecting to backend...');
      setProgressMessages([]);
      setStreamProgress({
        stage: 'Connecting',
        percent: 5,
        waiting: true,
        status: 'waiting',
      });
      appendProgressMessage('⏳ Connecting to backend...');

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

      try {
        const activeClarification = pendingClarification;
        let assistantContent = '';
        let assistantSources: AgentSource[] = [];
        let newThreadId = threadId;
        const latestToolResults = new Map<string, string>();

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
        await agentService.askStream(
          {
            question: activeClarification?.originalQuestion || question,
            thread_id: threadId,
            lang: options.language,
            provider: options.provider,
            model: options.model,
            clarification_response: activeClarification ? question : undefined,
          },
          (event: StreamEvent) => {
            switch (event.type) {
              case 'thinking':
                setStreamingMessage(event.message);
                updateProgressFromEvent(event);
                appendProgressMessage(`• ${event.message}`);
                break;

              case 'token':
                // Accumulate tokens as they stream in
                assistantContent += (event.content || '');
                // Update UI with streaming response
                setStreamingMessage('Generating response...');
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
                  const clarificationMessage = event.message
                    || (event.questions && event.questions.length > 0
                      ? event.questions.join(' ')
                      : 'Please provide more details so I can continue.');
                  const clarificationQuestions = (event.questions || event.suggestedQuestions || [])
                    .filter((value): value is string => Boolean(value && value.trim()))
                    .slice(0, 3);

                  const displayMessage = clarificationQuestions.length > 0
                    ? `Clarification needed:\n${clarificationMessage}\n\n${clarificationQuestions.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}`
                    : `Clarification needed: ${clarificationMessage}`;
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
                setStreamingMessage(event.message);
                updateProgressFromEvent(event);
                if (event.phase === 'start') {
                  appendProgressMessage(`⏳ ${event.message}`);
                } else if (event.phase === 'result') {
                  appendProgressMessage(`✅ ${event.message}`);
                } else {
                  appendProgressMessage(`⚠️ ${event.message}`);
                }
                if (event.phase === 'result' && event.tool && event.message) {
                  latestToolResults.set(event.tool, event.message);
                }
                break;
            }
          }
        );

        if (latestToolResults.size > 0) {
          const toolSummary = Array.from(latestToolResults.entries())
            .map(([toolName, summary]) => `• ${formatToolLabel(toolName)}\n  ${summary}`)
            .join('\n');
          appendAssistantEventMessage(
            `Tool Summary\n────────────\n${toolSummary}`
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
      } catch (err) {
        const agentError =
          err instanceof AgentServiceError
            ? err
            : new AgentServiceError('An unexpected error occurred');

        setError(agentError);
        if (options.onError) {
          options.onError(agentError);
        }

        // Add error message to chat
        const errorMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${agentError.message}`,
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
      pendingClarification,
      options.language,
      options.provider,
      options.model,
      options.onError,
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
