import { parseJsonResponseOrThrow } from '../lib/responseParser';

export interface Source {
  url: string;
  title?: string;
  source_domain?: string;
  tags?: string[];
  download_url?: string;
  downloadable?: boolean;
}

export interface Overview {
  sources: Source[];
}

export interface TagStat {
  tag: string;
  source_count: number;
}

interface TagStatsResponseRow {
  tag: string;
  source_count?: number;
}

export async function fetchDocumentsOverview(apiBase: string): Promise<Overview> {
  const response = await fetch(`${apiBase}/documents/overview`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return parseJsonResponseOrThrow<Overview>(response, '/documents/overview');
}

export async function fetchDocumentTagStats(apiBase: string, limit = 100): Promise<TagStat[]> {
  const response = await fetch(`${apiBase}/documents/tags?limit=${limit}`);
  if (!response.ok) {
    return [];
  }

  const payload = await parseJsonResponseOrThrow<{ tags?: TagStatsResponseRow[] }>(
    response,
    '/documents/tags'
  );

  return (payload.tags ?? []).map((row) => ({
    tag: row.tag,
    source_count: row.source_count ?? 0,
  }));
}

export async function fetchDownloadUrlForSource(apiBase: string, sourceUrl: string): Promise<string> {
  const response = await fetch(
    `${apiBase}/documents/download-url?source_url=${encodeURIComponent(sourceUrl)}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await parseJsonResponseOrThrow<{ download_url?: string }>(
    response,
    '/documents/download-url'
  );

  if (!payload.download_url) {
    throw new Error('NO_DOWNLOAD_URL');
  }

  return payload.download_url;
}
