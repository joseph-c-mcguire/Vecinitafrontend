import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../ChatMessage';

const speakSpy = vi.fn();
let screenReaderEnabled = false;

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => (key === 'sources' ? 'Sources' : key) }),
}));

vi.mock('../../context/AccessibilityContext', () => ({
  useAccessibility: () => ({
    settings: { screenReader: screenReaderEnabled },
    speak: speakSpy,
  }),
}));

describe('ChatMessage source attribution', () => {
  beforeEach(() => {
    screenReaderEnabled = false;
    speakSpy.mockClear();
  });

  it('speaks assistant responses when screen reader mode is enabled', () => {
    screenReaderEnabled = true;

    render(
      <ChatMessage
        message={{
          id: 'assistant-a11y-1',
          role: 'assistant',
          content: 'A nearby clinic can help you find a doctor.',
          timestamp: new Date(),
          sources: [],
        }}
      />
    );

    expect(speakSpy).toHaveBeenCalledWith('A nearby clinic can help you find a doctor.');
  });

  it('exposes stable message selectors for e2e journeys', () => {
    render(
      <ChatMessage
        message={{
          id: 'assistant-selector-1',
          role: 'assistant',
          content: 'Selector contract check.',
          timestamp: new Date(),
          sources: [],
        }}
      />
    );

    const message = screen.getByTestId('chat-message');
    expect(message).toHaveAttribute('data-message-role', 'assistant');
    expect(message).toHaveAttribute('role', 'article');
  });

  it('marks user messages with the user role selector contract', () => {
    render(
      <ChatMessage
        message={{
          id: 'user-selector-1',
          role: 'user',
          content: 'I need a doctor nearby.',
          timestamp: new Date(),
          sources: [],
        }}
      />
    );

    const message = screen.getByTestId('chat-message');
    expect(message).toHaveAttribute('data-message-role', 'user');
    expect(screen.getByText('I need a doctor nearby.')).toBeInTheDocument();
    expect(message.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders assistant markdown content safely', () => {
    render(
      <ChatMessage
        message={{
          id: 'assistant-md-1',
          role: 'assistant',
          content:
            '## Support Links\n\n- **Housing**\n- [Community Center](https://example.org/community)',
          timestamp: new Date(),
          sources: [],
        }}
      />
    );

    expect(screen.getByText('Support Links')).toBeInTheDocument();
    expect(screen.getByText('Housing')).toBeInTheDocument();
    const markdownLink = screen.getByRole('link', { name: 'Community Center' });
    expect(markdownLink).toHaveAttribute('href', 'https://example.org/community');
    expect(markdownLink).toHaveAttribute('target', '_blank');
    expect(markdownLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders source cards linked to original URLs', () => {
    render(
      <ChatMessage
        message={{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Here are resources with citations.',
          timestamp: new Date(),
          sources: [
            {
              title: 'Housing Benefits Guide',
              url: 'https://example.org/housing-guide',
              snippet: 'Official housing assistance guide',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Sources:')).toBeInTheDocument();

    const sourceLink = screen.getByRole('link', { name: /Source 1: Housing Benefits Guide/i });
    expect(sourceLink).toHaveAttribute('href', 'https://example.org/housing-guide');
    expect(screen.getByText('Official housing assistance guide')).toBeInTheDocument();
  });

  it('renders doctor-related markdown links and source cards together', () => {
    render(
      <ChatMessage
        message={{
          id: 'assistant-doctor-1',
          role: 'assistant',
          content:
            'Try the [Providence Community Health Center](https://clinic.example.org/providers) for help finding a doctor.',
          timestamp: new Date(),
          sources: [
            {
              title: 'Community Clinic Directory',
              url: 'https://clinic.example.org/directory',
              snippet: 'Directory of doctors and clinics near Providence.',
            },
          ],
        }}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Providence Community Health Center' })
    ).toHaveAttribute('href', 'https://clinic.example.org/providers');
    expect(
      screen.getByRole('link', { name: /Source 1: Community Clinic Directory/i })
    ).toHaveAttribute('href', 'https://clinic.example.org/directory');
  });
});
