import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentsDashboard from '../DocumentsDashboard';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        documentsTitle: 'Documents',
        documentsSubtitle: 'Community resources and reference materials available to everyone.',
        docsTotalSources: 'Community Sources',
        docsTotalTopics: 'Topics',
        docsVisibleResources: 'Visible Resources',
        docsResources: 'Resources',
        docsSearchPlaceholder: 'Search resources…',
        docsTopics: 'Topics',
        docsClearFilters: 'Clear filters',
        docsNoTopics: 'No topics available yet.',
        docsSourcesLabel: 'sources',
        docsResource: 'Resource',
        docsActions: 'Actions',
        docsNoResults: 'No resources match your filters.',
        docsOpenSource: 'Open source',
        docsDownload: 'Download',
        docsLoading: 'Loading resources…',
        docsLoadFailed: 'Failed to load resources',
        docsUnknownError: 'Unknown error',
        docsDownloadError: 'Unable to resolve a download link',
        docsNoDownloadAvailable: 'This resource does not have a downloadable file.',
        docsDownloadFailed: 'Failed to download resource',
      })[key] ?? key,
  }),
}));

describe('DocumentsDashboard integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/documents/overview')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sources: [
                {
                  url: 'https://example.org/a',
                  title: 'Example Source A',
                  source_domain: 'example.org',
                  tags: ['housing'],
                },
                {
                  url: 'https://example.org/b',
                  title: 'Example Source B',
                  source_domain: 'example.org',
                  tags: ['benefits'],
                },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tags: [
                { tag: 'housing', source_count: 2, chunk_count: 7 },
                { tag: 'benefits', source_count: 1, chunk_count: 3 },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/preview')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ chunks: [] }),
          } as Response);
        }

        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );
  });

  it('renders community resources and topic filters from API data', async () => {
    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    expect(screen.getByText('Community Sources')).toBeInTheDocument();
    expect(screen.getByText('Visible Resources')).toBeInTheDocument();
    expect(screen.getByText('Example Source A')).toBeInTheDocument();
    expect(screen.getByText('Example Source B')).toBeInTheDocument();
    expect(screen.getByText('https://example.org/a')).toBeInTheDocument();
    expect(screen.getByText('housing (2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'housing (2)' })).toBeInTheDocument();
    expect(screen.queryByText('Total Chunks')).not.toBeInTheDocument();
    expect(screen.queryByText('Embedding Model')).not.toBeInTheDocument();
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('supports topic filtering and renders actionable source links', async () => {
    const user = userEvent.setup();

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Example Source A')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'benefits (1)' }));

    await waitFor(() => {
      expect(screen.queryByText('Example Source A')).not.toBeInTheDocument();
      expect(screen.getByText('Example Source B')).toBeInTheDocument();
    });

    const openSourceLink = screen.getByRole('link', { name: 'Open source' });
    expect(openSourceLink).toHaveAttribute('href', 'https://example.org/b');
    expect(openSourceLink).toHaveAttribute('target', '_blank');
  });
});
