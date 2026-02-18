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

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const [threadId, setThreadId] = useState<string>(
    options.initialThreadId || uuidv4()
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [error, setError] = useState<AgentServiceError | null>(null);

  const storage = useConversationStorage(threadId);

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
      setStreamingMessage(null);

      // Create and add user message immediately
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      storage.saveMessages(updatedMessages);

      try {
        let assistantContent = '';
        let assistantSources: AgentSource[] = [];
        let newThreadId = threadId;

        // Stream response from agent
        await agentService.askStream(
          {
            question,
            thread_id: threadId,
            lang: options.language,
            provider: options.provider,
            model: options.model,
          },
          (event: StreamEvent) => {
            switch (event.type) {
              case 'thinking':
                setStreamingMessage(event.message);
                break;

              case 'token':
                // Accumulate tokens as they stream in
                assistantContent += (event.content || '');
                // Update UI with streaming response
                setStreamingMessage(null); // Clear thinking message when tokens arrive
                // Show current accumulated response
                if (setStreamingMessage) {
                  setStreamingMessage(assistantContent.substring(0, 100) + '...');
                }
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
                if (event.thread_id) {
                  newThreadId = event.thread_id;
                }
                // Store metadata for debugging (not shown to user)
                console.debug('Streaming complete. Metadata:', event.metadata);
                setStreamingMessage(null);
                break;

              case 'clarification':
                // Handle clarification requests
                setStreamingMessage(`Clarification: ${event.message}`);
                break;

              case 'error':
                throw new AgentServiceError(
                  event.message,
                  undefined,
                  event.code
                );
            }
          }
        );

        // Create assistant message
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: assistantContent,
          sources: mapSources(assistantSources),
          timestamp: new Date(),
        };

        // Update state and storage
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

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

        const finalMessages = [...updatedMessages, errorMessage];
        setMessages(finalMessages);
        storage.saveMessages(finalMessages);
      } finally {
        setIsLoading(false);
        setStreamingMessage(null);
      }
    },
    [
      messages,
      threadId,
      storage,
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
   * Clear the current thread and start fresh.
   */
  const clearThread = useCallback(() => {
    storage.deleteThread();
    setMessages([]);
    setThreadId(uuidv4());
    setError(null);
    setStreamingMessage(null);
  }, [storage]);

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
    sendMessage,
    loadThread,
    clearThread,
    retryLastMessage,
    getAllThreadIds: storage.getAllThreadIds,
    getTimeRemaining: storage.getTimeRemaining,
  };
}
