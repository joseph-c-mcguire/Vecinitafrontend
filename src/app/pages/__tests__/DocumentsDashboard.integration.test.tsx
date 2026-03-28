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
    vi.stubGlobal('alert', vi.fn());

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

  it('renders an error state when the documents request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/documents/overview')) {
          return Promise.resolve({ ok: false, status: 503 } as Response);
        }

        if (url.includes('/documents/tags')) {
          return Promise.resolve({ ok: true, json: async () => ({ tags: [] }) } as Response);
        }

        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load resources: HTTP 503')).toBeInTheDocument();
    });
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

  it('renders open-source actions only for external http resources', async () => {
    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Example Source A')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: 'Open source' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('resolves document download links and opens them in a new tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

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
                  url: 'stored/clinic-flyer.pdf',
                  title: 'Clinic Flyer',
                  source_domain: 'storage',
                  tags: ['health'],
                  downloadable: true,
                },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: [{ tag: 'health', source_count: 1 }] }),
          } as Response);
        }

        if (url.includes('/documents/download-url')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              download_url: 'https://downloads.example.org/clinic-flyer.pdf',
            }),
          } as Response);
        }

        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Clinic Flyer')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://downloads.example.org/clinic-flyer.pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('uses an existing download_url without requesting a new one', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/documents/overview')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sources: [
              {
                url: 'stored/ready-download.pdf',
                title: 'Ready Download',
                source_domain: 'storage',
                tags: ['health'],
                download_url: 'https://downloads.example.org/ready-download.pdf',
              },
            ],
          }),
        } as Response);
      }

      if (url.includes('/documents/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: [{ tag: 'health', source_count: 1 }] }),
        } as Response);
      }

      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    vi.stubGlobal('fetch', fetchSpy);

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Ready Download')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://downloads.example.org/ready-download.pdf',
      '_blank',
      'noopener,noreferrer'
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/documents/download-url')
    );
  });

  it('disables the download action while resolving the download URL', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    let resolveDownloadRequest: ((value: Response) => void) | undefined;

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
                  url: 'stored/pending-download.pdf',
                  title: 'Pending Download',
                  source_domain: 'storage',
                  tags: ['health'],
                  downloadable: true,
                },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: [{ tag: 'health', source_count: 1 }] }),
          } as Response);
        }

        if (url.includes('/documents/download-url')) {
          return new Promise<Response>((resolve) => {
            resolveDownloadRequest = resolve;
          });
        }

        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pending Download')).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole('button', { name: 'Download' });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '…' })).toBeDisabled();
    });

    resolveDownloadRequest?.({
      ok: true,
      json: async () => ({
        download_url: 'https://downloads.example.org/pending-download.pdf',
      }),
    } as Response);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://downloads.example.org/pending-download.pdf',
        '_blank',
        'noopener,noreferrer'
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    });
  });

  it('alerts when download URL resolution fails', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.mocked(globalThis.alert);

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
                  url: 'stored/failing-download.pdf',
                  title: 'Failing Download',
                  source_domain: 'storage',
                  tags: ['health'],
                  downloadable: true,
                },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: [{ tag: 'health', source_count: 1 }] }),
          } as Response);
        }

        if (url.includes('/documents/download-url')) {
          return Promise.resolve({ ok: false, status: 500 } as Response);
        }

        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );

    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failing Download')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Unable to resolve a download link (HTTP 500)');
    });
  });
});
