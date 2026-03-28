import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatWidget } from '../ChatWidget';
import { LanguageProvider } from '../../context/LanguageContext';
import { AccessibilityProvider } from '../../context/AccessibilityContext';
import { BackendSettingsProvider } from '../../context/BackendSettingsContext';

import { agentService } from '../../services/agentService';

vi.mock('../../services/agentService', async () => {
  const actual = await vi.importActual<typeof import('../../services/agentService')>(
    '../../services/agentService'
  );

  return {
    ...actual,
    agentService: {
      ...actual.agentService,
      askStream: vi.fn(),
      ask: vi.fn(),
      getConfig: vi.fn(),
      healthCheck: vi.fn(),
    },
  };
});

vi.mock('uuid', () => ({
  v4: (() => {
    let counter = 0;
    return () => {
      counter += 1;
      return `chat-widget-test-uuid-${counter}`;
    };
  })(),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <BackendSettingsProvider>{children}</BackendSettingsProvider>
      </AccessibilityProvider>
    </LanguageProvider>
  );
}

describe('ChatWidget stream success integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(agentService.getConfig).mockResolvedValue({
      providers: [{ name: 'groq', models: ['llama-3.1-8b-instant'], default: true }],
      models: { groq: ['llama-3.1-8b-instant'] },
      defaultProvider: 'groq',
      defaultModel: 'llama-3.1-8b-instant',
    });

    vi.mocked(agentService.ask).mockResolvedValue({
      answer: 'THIS SHOULD NOT BE USED',
      sources: [],
      thread_id: 'fallback-thread',
    });
  });

  it.skip('renders streamed assistant response and does not use fallback/canned response', async () => {
    const user = userEvent.setup();

    vi.mocked(agentService.askStream).mockImplementation(async (_params, onEvent) => {
      onEvent({ type: 'thinking', message: 'Searching for relevant resources...' });
      onEvent({
        type: 'complete',
        answer: 'Real streamed answer from retrieved context.',
        sources: [
          {
            title: 'Resource A',
            url: 'https://example.com/resource-a',
            metadata: { content: 'Relevant snippet' },
          },
        ],
        thread_id: 'stream-thread-1',
      });
    });

    render(
      <TestWrapper>
        <ChatWidget defaultOpen />
      </TestWrapper>
    );

    const input = await screen.findByRole('textbox');
    await user.type(input, 'Testing 1 2 3');

    const sendButton = screen.getByRole('button', { name: /send|enviar/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Real streamed answer from retrieved context.')).toBeInTheDocument();
    });

    expect(agentService.askStream).toHaveBeenCalledTimes(1);
    expect(agentService.ask).not.toHaveBeenCalled();

    expect(
      screen.queryByText('I could not generate a response right now. Please try again.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('THIS SHOULD NOT BE USED')).not.toBeInTheDocument();
  });
});
