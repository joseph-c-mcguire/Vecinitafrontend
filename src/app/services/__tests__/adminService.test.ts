import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addSource,
  getMetadataTags,
  getSources,
  updateSourceTags,
  uploadDocument,
} from '../adminService';

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabaseConfigError: '',
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
          },
        },
      }),
    },
  },
}));

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('sends tags when adding a source', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'queued', url: 'https://example.com', depth: 1, tags: ['housing'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await addSource('https://example.com', 1, ['housing']);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = call[1]?.body as FormData;
    expect(body.get('url')).toBe('https://example.com');
    expect(body.get('depth')).toBe('1');
    expect(body.get('tags')).toBe('housing');
  });

  it('sends tags during upload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 'ok', filename: 'test.txt', chunks_total: 1, chunks_inserted: 1, tags: ['food'], errors: [] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await uploadDocument(file, ['food']);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = call[1]?.body as FormData;
    expect(body.get('file')).toBeTruthy();
    expect(body.get('tags')).toBe('food');
  });

  it('normalizes source list fields for tags and chunk counts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sources: [
            {
              url: 'https://example.com',
              chunk_count: 3,
              metadata: { tags: ['housing'] },
              is_active: true,
            },
          ],
          total: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await getSources();
    expect(result.sources[0].total_chunks).toBe(3);
    expect(result.sources[0].tags).toEqual(['housing']);
  });

  it('normalizes real sources-table payload shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sources: [
            {
              id: '01832f0c-5d3c-4b69-bdbe-b8c68bd0eb37',
              url: 'https://www.nuestrasalud.com/blog/example',
              domain: 'www.nuestrasalud.com',
              source_domain: 'www.nuestrasalud.com',
              scrape_count: 1,
              reliability_score: '1.00',
              total_chunks: 6,
              total_characters: 4826,
              metadata: '{"tags":["health","community"]}',
              is_active: true,
            },
          ],
          total: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await getSources();
    const source = result.sources[0];
    expect(source.total_chunks).toBe(6);
    expect(source.domain).toBe('www.nuestrasalud.com');
    expect(source.source_domain).toBe('www.nuestrasalud.com');
    expect(source.scrape_count).toBe(1);
    expect(source.total_characters).toBe(4826);
    expect(source.tags).toEqual(['health', 'community']);
    expect(source.metadata).toEqual({ tags: ['health', 'community'] });
  });

  it('updates source tags via PATCH', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'updated', chunks_updated: 2, tags: ['housing'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await updateSourceTags('https://example.com', ['housing']);
    expect(result.status).toBe('updated');

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[1]?.method).toBe('PATCH');
    expect(call[1]?.body).toBe(JSON.stringify({ url: 'https://example.com', tags: ['housing'] }));
  });

  it('fetches metadata tags for autocomplete', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ tags: ['food', 'housing'], total: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await getMetadataTags('ho', 10);
    expect(result.tags).toEqual(['food', 'housing']);

    const callUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(callUrl).toContain('/admin/tags?');
    expect(callUrl).toContain('query=ho');
    expect(callUrl).toContain('limit=10');
  });
});
