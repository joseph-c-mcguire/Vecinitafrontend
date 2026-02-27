import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChatPage from '../ChatPage';
import { useAgentChat } from '../../hooks/useAgentChat';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const translations: Record<string, string> = {
        appTitle: 'Vecinita',
        appSubtitle: 'Environmental & Community Information Assistant',
        newChat: 'New chat',
        welcomeMessage: 'Welcome to Vecinita',
        typePlaceholder: 'Type your question...',
        sendMessage: 'Send message',
        'error.title': 'Error',
        'error.retry': 'Retry',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../hooks/useBackendSettings', () => ({
  useBackendSettings: () => ({
    selectedLLM: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
    },
  }),
}));

vi.mock('../../hooks/useAgentChat');

vi.mock('../../components/ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { content: string } }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

vi.mock('../../components/StreamingIndicator', () => ({
  StreamingIndicator: ({ message }: { message: string }) => (
    <div data-testid="streaming-indicator">{message}</div>
  ),
}));

vi.mock('../../components/ChatWidget', () => ({
  ChatWidget: () => <div data-testid="chat-widget" />,
}));

describe('ChatPage', () => {
  const mockSendMessage = vi.fn();
  const mockClearThread = vi.fn();
  const mockRetryLastMessage = vi.fn();

  const defaultHookState = {
    messages: [],
    isLoading: false,
    streamingMessage: null,
    progressMessages: [],
    streamProgress: { stage: 'Working', percent: 0, waiting: false, status: 'working' },
    pendingClarification: null,
    error: null,
    sendMessage: mockSendMessage,
    clearThread: mockClearThread,
    retryLastMessage: mockRetryLastMessage,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(useAgentChat).mockReturnValue(defaultHookState);
    mockSendMessage.mockResolvedValue(undefined);
  });

  it('renders title, subtitle, welcome, and chat widget', () => {
    render(<ChatPage />);

    expect(screen.getByRole('heading', { name: 'Vecinita' })).toBeInTheDocument();
    expect(screen.getByText('Environmental & Community Information Assistant')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Vecinita')).toBeInTheDocument();
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument();
  });

  it('sends a message from submit button and clears textarea', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    const textarea = screen.getByPlaceholderText('Type your question...');
    await user.type(textarea, 'Where can I find housing support?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(mockSendMessage).toHaveBeenCalledWith('Where can I find housing support?');
    expect(textarea).toHaveValue('');
  });

  it('keeps composer form and textarea full width', () => {
    render(<ChatPage />);

    const textarea = screen.getByPlaceholderText('Type your question...');
    const form = textarea.closest('form');

    expect(form).toHaveClass('w-full');
    expect(textarea).toHaveClass('w-full');
    expect(textarea).toHaveClass('min-w-0');
  });

  it('submits on Enter and keeps content on Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    const textarea = screen.getByPlaceholderText('Type your question...');

    await user.type(textarea, 'Line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(mockSendMessage).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(mockSendMessage).toHaveBeenCalledWith('Line one\n');
  });

  it('does not submit empty messages and disables submit while loading', async () => {
    const user = userEvent.setup();
    vi.mocked(useAgentChat).mockReturnValue({
      ...defaultHookState,
      isLoading: true,
    });

    render(<ChatPage />);

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Type your question...');
    expect(textarea).toBeDisabled();

    await user.click(sendButton);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('calls clearThread when New chat is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(mockClearThread).toHaveBeenCalled();
  });

  it('renders clarification prompt and questions when pending clarification exists', () => {
    vi.mocked(useAgentChat).mockReturnValue({
      ...defaultHookState,
      pendingClarification: {
        prompt: 'Please clarify your neighborhood',
        questions: ['What city are you in?', 'Do you need immediate help?'],
      },
    });

    render(<ChatPage />);

    expect(
      screen.getByText((text) => text === 'Action required' || text === 'clarificationActionRequired')
    ).toBeInTheDocument();
    expect(screen.getByText('Please clarify your neighborhood')).toBeInTheDocument();
    expect(screen.getByText('1. What city are you in?')).toBeInTheDocument();
    expect(screen.getByText('2. Do you need immediate help?')).toBeInTheDocument();
  });

  it('renders latest backend progress hint while loading', () => {
    vi.mocked(useAgentChat).mockReturnValue({
      ...defaultHookState,
      isLoading: true,
      progressMessages: ['Searching', 'Scoring documents'],
      streamProgress: { stage: 'Retrieval', percent: 40, waiting: true, status: 'working' },
    });

    render(<ChatPage />);

    expect(screen.getByText('Scoring documents')).toBeInTheDocument();
    expect(screen.queryByText('Searching')).not.toBeInTheDocument();
    expect(screen.queryByText(/Connecting\s*·/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Waiting$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/⏳/)).not.toBeInTheDocument();
  });

  it('renders error and retries last message when clicking Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(useAgentChat).mockReturnValue({
      ...defaultHookState,
      error: {
        message: 'Request failed',
        code: 'NETWORK_ERROR',
      },
    });

    render(<ChatPage />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Request failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRetryLastMessage).toHaveBeenCalled();
  });
});