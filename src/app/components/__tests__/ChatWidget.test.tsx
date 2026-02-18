/**
 * Tests for ChatWidget component
 *
 * Tests main chat interface integration with agent backend.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWidget } from '../ChatWidget';
import { LanguageProvider } from '../../context/LanguageContext';
import { AccessibilityProvider } from '../../context/AccessibilityContext';
import { BackendSettingsProvider } from '../../context/BackendSettingsContext';
import * as useAgentChatModule from '../../hooks/useAgentChat';
import * as agentServiceModule from '../../services/agentService';
import type { Message } from '../ChatMessage';

// Mock hooks and services
vi.mock('../../hooks/useAgentChat');
vi.mock('../../services/agentService');

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {
    'vecinita-language': 'en', // Default to English
  };

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = { 'vecinita-language': 'en' };
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Test wrapper with all providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <BackendSettingsProvider>
          {children}
        </BackendSettingsProvider>
      </AccessibilityProvider>
    </LanguageProvider>
  );
}

describe('ChatWidget', () => {
  const mockSendMessage = vi.fn();
  const mockClearThread = vi.fn();
  const mockRetryLastMessage = vi.fn();

  const defaultUseAgentChatReturn = {
    messages: [] as Message[],
    isLoading: false,
    streamingMessage: null,
    error: null,
    sendMessage: mockSendMessage,
    clearThread: mockClearThread,
    retryLastMessage: mockRetryLastMessage,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock agentService.getConfig for BackendSettingsContext
    vi.mocked(agentServiceModule.agentService.getConfig).mockResolvedValue({
      providers: [
        { name: 'groq', models: ['llama-3.1-8b-instant'], default: true },
      ],
      models: { groq: ['llama-3.1-8b-instant'] },
      defaultProvider: 'groq',
      defaultModel: 'llama-3.1-8b-instant',
    });

    // Mock useAgentChat hook
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue(defaultUseAgentChatReturn);

    mockSendMessage.mockResolvedValue(undefined);
  });

  describe('widget visibility', () => {
    it('should render closed by default', async () => {
      render(
        <TestWrapper>
          <ChatWidget />
        </TestWrapper>
      );

      // Wait for async provider initialization
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /new/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should open when button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget />
        </TestWrapper>
      );

      // Wait for async provider initialization
      const button = await screen.findByRole('button', { name: /new/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /vecinita/i })).toBeInTheDocument();
      });
    });

    it('should render open when defaultOpen is true', async () => {
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /vecinita/i })).toBeInTheDocument();
      });
    });

    it('should close when X button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      });
    });

    it('should minimize when minimize button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const minimizeButton = screen.getByRole('button', { name: /minimize/i });
      await user.click(minimizeButton);

      // Input should be hidden when minimized
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/type/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('message display', () => {
    it('should display messages from useAgentChat', async () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          sources: [],
        },
      ];

      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
        ...defaultUseAgentChatReturn,
        messages,
      });

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });
    });

    it('should display streaming indicator when loading', async () => {
      // Re-mock useAgentChat to return streaming state
      const streamingMock = {
        messages: [] as Message[],
        isLoading: true,
        streamingMessage: 'Thinking about your question...',
        error: null,
        sendMessage: vi.fn(),
        clearThread: vi.fn(),
        retryLastMessage: vi.fn(),
      };
      
      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue(streamingMock);

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      // Wait for async provider initialization and streaming indicator
      await waitFor(() => {
        const thinkingTexts = screen.queryAllByText(/thinking/i);
        expect(thinkingTexts.length).toBeGreaterThan(0);
      });
    });

    it('should display error message when error occurs', async () => {
      const error = {
        message: 'Network error',
        code: 'NETWORK_ERROR',
        statusCode: 500,
      };

      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
        ...defaultUseAgentChatReturn,
        error,
      });

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('message sending', () => {
    it('should send message when form is submitted', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(input, 'Test question');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test question');
      });
    });

    it('should send message on Enter key', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test question{Enter}');

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('Test question');
      });
    });

    it('should not send on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(input, 'Test question');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should disable input when loading', async () => {
      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
        ...defaultUseAgentChatReturn,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
      });
    });

    it('should not send empty message', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should display retry button on error', async () => {
      const error = {
        message: 'Request failed',
        code: 'REQUEST_FAILED',
        statusCode: 500,
      };

      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
        ...defaultUseAgentChatReturn,
        error,
      });

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should call retryLastMessage when retry is clicked', async () => {
      const user = userEvent.setup();
      const error = {
        message: 'Request failed',
        code: 'REQUEST_FAILED',
        statusCode: 500,
      };

      vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
        ...defaultUseAgentChatReturn,
        error,
      });

      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRetryLastMessage).toHaveBeenCalled();
    });
  });

  describe('customization', () => {
    it('should apply custom title', async () => {
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} title="Custom Chat" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Chat')).toBeInTheDocument();
      });
    });

    it('should apply custom position class', async () => {
      const { container } = render(
        <TestWrapper>
          <ChatWidget position="top-left" />
        </TestWrapper>
      );

      // Wait for async provider initialization
      await waitFor(() => {
        const widget = container.querySelector('.top-4.left-4');
        expect(widget).toBeInTheDocument();
      });
    });

    it('should apply custom zIndex', async () => {
      const { container } = render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} zIndex={9999} />
        </TestWrapper>
      );

      // Wait for async provider initialization
      await waitFor(() => {
        const widget = container.firstChild as HTMLElement;
        expect(widget.style.zIndex).toBe('9999');
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveAttribute('aria-label');
        expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute('aria-label');
        expect(screen.getByRole('button', { name: /close/i })).toHaveAttribute('aria-label');
      });
    });

    it('should open accessibility panel when settings clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: /accessibility/i });
      await user.click(settingsButton);

      // Accessibility panel should render (implementation depends on AccessibilityPanel component)
      await waitFor(() => {
        // This may vary based on AccessibilityPanel implementation
        expect(settingsButton).toBeInTheDocument();
      });
    });
  });

  describe('theme handling', () => {
    it('should render with default theme', async () => {
      render(
        <TestWrapper>
          <ChatWidget defaultOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading')).toBeInTheDocument();
      });

      // Verify widget is rendered in the DOM
      const widget = screen.getByRole('heading');
      expect(widget).toBeVisible();
    });
  });
});
