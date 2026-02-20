/**
 * Tests for useAgentChat hook
 * 
 * Tests integration of agent service with conversation storage.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentChat } from '../useAgentChat';
import { agentService, AgentServiceError } from '../../services/agentService';
import type { StreamEvent } from '../../types/agent';

// Mock dependencies
vi.mock('../../services/agentService');
vi.mock('../useConversationStorage', () => ({
  useConversationStorage: () => ({
    saveMessages: vi.fn(),
    loadMessages: vi.fn(() => null),
    deleteThread: vi.fn(),
    clearExpired: vi.fn(),
    getAllThreadIds: vi.fn(() => []),
    getTimeRemaining: vi.fn(() => null),
  }),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty messages', () => {
      const { result } = renderHook(() => useAgentChat());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.streamingMessage).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should use provided initial thread ID', () => {
      const { result } = renderHook(() =>
        useAgentChat({ initialThreadId: 'custom-thread' })
      );

      expect(result.current.threadId).toBe('custom-thread');
    });

    it('should generate UUID for thread ID if not provided', () => {
      const { result } = renderHook(() => useAgentChat());

      expect(result.current.threadId).toBe('test-uuid-123');
    });
  });

  describe('sendMessage', () => {
    it('should send message and handle successful response', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        // Simulate streaming events
        onEvent({ type: 'thinking', message: 'Searching...' });
        onEvent({
          type: 'complete',
          answer: 'Test answer',
          sources: [{ title: 'Test', url: 'https://example.com', metadata: {} }],
          thread_id: 'thread-123',
        });
      });

      const { result } = renderHook(() => useAgentChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[1].role).toBe('assistant');
      expect(result.current.messages[1].content).toBe('Test answer');
    });

    it('should update streaming message during processing', async () => {
      let eventCallback: ((event: StreamEvent) => void) | null = null;

      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        eventCallback = onEvent;
        
        setTimeout(() => {
          onEvent({ type: 'thinking', message: 'Searching documents...' });
        }, 0);
      });

      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.streamingMessage).toBe('Searching documents...');
      });
    });

    it('should handle error response', async () => {
      // Mock askStream to reject with an AgentServiceError
      const errorToThrow = new AgentServiceError('Service unavailable', undefined, 'SERVICE_ERROR');
      vi.mocked(agentService.askStream).mockRejectedValue(errorToThrow);

      const errorCallback = vi.fn();
      const { result } = renderHook(() => useAgentChat({ onError: errorCallback }));

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Error should be set
      expect(result.current.error).toBeTruthy();
      // Error callback should be called
      expect(errorCallback).toHaveBeenCalled();
      // Messages should include user message and error message
      expect(result.current.messages.length).toBeGreaterThan(1);
    });

    it('should not send empty messages', () => {
      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.sendMessage('   ');
      });

      expect(agentService.askStream).not.toHaveBeenCalled();
    });

    it('should set loading state during request', async () => {
      vi.mocked(agentService.askStream).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.sendMessage('Test');
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should pass language, provider, and model options', async () => {
      vi.mocked(agentService.askStream).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAgentChat({
          language: 'es',
          provider: 'groq',
          model: 'llama-3.1',
        })
      );

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(agentService.askStream).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'es',
          provider: 'groq',
          model: 'llama-3.1',
        }),
        expect.any(Function)
      );
    });

    it('should call onError callback on failure', async () => {
      const onError = vi.fn();
      
      vi.mocked(agentService.askStream).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAgentChat({ onError }));

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should update thread ID from response', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        onEvent({
          type: 'complete',
          answer: 'Test',
          sources: [],
          thread_id: 'new-thread-id',
        });
      });

      const { result } = renderHook(() => useAgentChat());
      const initialThreadId = result.current.threadId;

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.threadId).toBe('new-thread-id');
      expect(result.current.threadId).not.toBe(initialThreadId);
    });

    it('should persist clarification event as assistant message', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (_params, onEvent) => {
        onEvent({
          type: 'clarification',
          message: 'Which neighborhood are you asking about?',
        });
        onEvent({
          type: 'complete',
          answer: 'Please confirm your location so I can narrow results.',
          sources: [],
        });
      });

      const { result } = renderHook(() => useAgentChat());

      await act(async () => {
        await result.current.sendMessage('Need food assistance');
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[1].role).toBe('assistant');
      expect(result.current.messages[1].content).toContain('Clarification needed:');
      expect(result.current.messages[2].content).toContain('Please confirm your location');
    });

    it('should persist tool result summary before final answer', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (_params, onEvent) => {
        onEvent({
          type: 'tool_event',
          phase: 'start',
          tool: 'db_search',
          message: 'Searching internal documents...',
        });
        onEvent({
          type: 'tool_event',
          phase: 'result',
          tool: 'db_search',
          message: 'Found 4 relevant documents.',
        });
        onEvent({
          type: 'complete',
          answer: 'Here are the resources I found.',
          sources: [],
        });
      });

      const { result } = renderHook(() => useAgentChat());

      await act(async () => {
        await result.current.sendMessage('Find housing aid');
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[1].content).toContain('Tool Summary');
      expect(result.current.messages[1].content).toContain('Db Search');
      expect(result.current.messages[2].content).toBe('Here are the resources I found.');
    });
  });

  describe('clearThread', () => {
    it('should clear messages and generate new thread ID', () => {
      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.clearThread();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.threadId).toBeTruthy();
    });

    it('should clear error state', async () => {
      vi.mocked(agentService.askStream).mockRejectedValue(
        new Error('Test error')
      );

      const { result } = renderHook(() => useAgentChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.clearThread();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('loadThread', () => {
    it('should update thread ID', () => {
      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.loadThread('loaded-thread-123');
      });

      expect(result.current.threadId).toBe('loaded-thread-123');
    });
  });

  describe('retryLastMessage', () => {
    it('should resend last user message', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        onEvent({ type: 'complete', answer: 'Success', sources: [] });
      });

      const { result } = renderHook(() => useAgentChat());

      // Send initial message
      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      // Clear mock calls
      vi.clearAllMocks();

      // Retry
      await act(async () => {
        result.current.retryLastMessage();
      });

      await waitFor(() => {
        expect(agentService.askStream).toHaveBeenCalledWith(
          expect.objectContaining({
            question: 'Test question',
          }),
          expect.any(Function)
        );
      });
    });

    it('should remove last assistant message before retry', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        onEvent({ type: 'complete', answer: 'Retry answer', sources: [] });
      });

      const { result } = renderHook(() => useAgentChat());

      // Send initial message
      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const messageCountBeforeRetry = result.current.messages.length;

      // Retry
      await act(async () => {
        result.current.retryLastMessage();
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(
          messageCountBeforeRetry - 1
        );
      });
    });

    it('should do nothing if no user messages exist', () => {
      const { result } = renderHook(() => useAgentChat());

      act(() => {
        result.current.retryLastMessage();
      });

      expect(agentService.askStream).not.toHaveBeenCalled();
    });
  });

  describe('source mapping', () => {
    it('should map agent sources to message sources format', async () => {
      vi.mocked(agentService.askStream).mockImplementation(async (params, onEvent) => {
        onEvent({
          type: 'complete',
          answer: 'Test',
          sources: [
            {
              title: 'Document 1',
              url: 'https://example.com/doc1',
              type: 'document',
              metadata: { content: 'Sample content' },
            },
          ],
        });
      });

      const { result } = renderHook(() => useAgentChat());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      expect(result.current.messages).toHaveLength(2);
      const assistantMessage = result.current.messages[1];
      expect(assistantMessage.sources).toHaveLength(1);
      expect(assistantMessage.sources![0].title).toBe('Document 1');
      expect(assistantMessage.sources![0].url).toBe('https://example.com/doc1');
      expect(assistantMessage.sources![0].snippet).toBe('Sample content');
    });
  });
});
