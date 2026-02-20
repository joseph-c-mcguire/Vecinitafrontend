import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '../ChatMessage';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => (key === 'sources' ? 'Sources' : key) }),
}));

vi.mock('../../context/AccessibilityContext', () => ({
  useAccessibility: () => ({
    settings: { screenReader: false },
    speak: vi.fn(),
  }),
}));

describe('ChatMessage source attribution', () => {
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
});
