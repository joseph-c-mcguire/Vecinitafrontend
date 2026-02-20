import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentsDashboard from '../DocumentsDashboard';

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
              total_chunks: 12,
              unique_sources: 2,
              avg_chunk_size: 320,
              embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
              embedding_dimension: 384,
              sources: [
                {
                  url: 'https://example.org/a',
                  title: 'Example Source A',
                  source_domain: 'example.org',
                  total_chunks: 8,
                },
                {
                  url: 'https://example.org/b',
                  title: 'Example Source B',
                  source_domain: 'example.org',
                  total_chunks: 4,
                },
              ],
            }),
          } as Response);
        }

        if (url.includes('/documents/chunk-statistics')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ rows: [] }),
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

  it('renders chunk/source stats and source rows from API data', async () => {
    render(<DocumentsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Example Source A')).toBeInTheDocument();
    expect(screen.getByText('Example Source B')).toBeInTheDocument();
    expect(screen.getByText('https://example.org/a')).toBeInTheDocument();
    expect(screen.getByText('housing (2)')).toBeInTheDocument();
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });
});
