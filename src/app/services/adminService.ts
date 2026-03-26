/**
 * Admin Service — typed API client for all admin write endpoints.
 *
 * All methods require a valid Supabase session token (Bearer).
 * The token is read from the current Supabase auth session automatically.
 */

import { supabase, isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';

const DEV_ADMIN_ENABLED =
  (import.meta.env.VITE_DEV_ADMIN_ENABLED || 'false').toLowerCase() === 'true';
const DEV_ADMIN_STORAGE_KEY = 'vecinita-dev-admin-session';
function _getDevAdminToken(): string | null {
  if (!DEV_ADMIN_ENABLED) {
    return null;
  }

  const raw = localStorage.getItem(DEV_ADMIN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
    return null;
  }
}

function resolveApiBase(rawUrl: string): string {
  if (typeof window === 'undefined') {
    return rawUrl;
  }

  const currentHost = window.location.hostname;
  const isCurrentHostLocal =
    currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';

  if (isCurrentHostLocal) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const isConfiguredLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    const isGatewayPort = parsed.port === '8004' || parsed.port === '18004';
    const isStaleAbsoluteHost = parsed.hostname !== currentHost;

    if (isConfiguredLocal || (isGatewayPort && isStaleAbsoluteHost)) {
      parsed.hostname = currentHost;
      return parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    return rawUrl;
  }

  return rawUrl;
}

const API_BASE = resolveApiBase(
  import.meta.env.VITE_GATEWAY_URL ||
    (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8004/api/v1')
);

function _candidateApiBases(): string[] {
  const candidates: string[] = [API_BASE];

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    candidates.push('/api/v1');

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      candidates.push('http://localhost:18004/api/v1');
      candidates.push('http://localhost:8004/api/v1');
    } else {
      candidates.push(`${protocol}//${hostname}:18004/api/v1`);
      candidates.push(`${protocol}//${hostname}:8004/api/v1`);
    }
  }

  return Array.from(new Set(candidates.map((item) => item.replace(/\/+$/, ''))));
}

function _isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  const message = String(error.message || '').toLowerCase();
  return message.includes('fetch') || message.includes('network');
}

async function _fetchAdmin(path: string, init?: RequestInit): Promise<Response> {
  const bases = _candidateApiBases();
  let lastError: unknown;

  for (const base of bases) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (error) {
      lastError = error;
      if (!_isNetworkFetchError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new TypeError('Failed to fetch');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _getToken(): Promise<string> {
  const devAdminToken = _getDevAdminToken();
  if (devAdminToken) {
    return devAdminToken;
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(supabaseConfigError);
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated. Please sign in.');
    }
    return session.access_token;
  } catch (error) {
    const fallbackToken = _getDevAdminToken();
    if (fallbackToken) {
      return fallbackToken;
    }
    throw error;
  }
}

async function _authHeaders(): Promise<HeadersInit> {
  const token = await _getToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function _handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Admin API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Source management
// ---------------------------------------------------------------------------

export interface QueueJob {
  id: string;
  url?: string | null;
  file_path?: string;
  depth?: number;
  job_type?: 'url' | 'file';
  status: 'pending' | 'running' | 'done' | 'failed' | 'processing' | 'completed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  chunks_processed?: number;
  total_chunks?: number;
  error?: string;
}

export interface QueueStatusSummaryItem {
  status: string;
  job_count: number;
  total_chunks_processed: number | null;
  avg_processing_time_seconds: number | null;
}

export interface AddSourceResult {
  status: string;
  url: string;
  depth: number;
  tags?: string[];
  chunks_total?: number;
  chunks_inserted?: number;
  job_id?: string;
}

export interface BatchAddSourcesResult {
  status: 'completed' | 'partial';
  submitted: number;
  completed: number;
  failed: number;
  depth: number;
  tag_mode: 'none' | 'baseline_only' | 'auto_infer';
  baseline_tags: string[];
  results: Array<{
    url: string;
    status: 'completed' | 'failed';
    error?: string;
    result?: AddSourceResult;
  }>;
}

export async function addSource(
  url: string,
  depth = 1,
  tags: string[] = []
): Promise<AddSourceResult> {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('url', url);
  form.append('depth', String(depth));
  if (tags.length > 0) {
    form.append('tags', tags.join(','));
  }
  // Remove Content-Type header — browser sets it with the correct boundary for FormData
  delete (headers as Record<string, string>)['Content-Type'];
  const res = await _fetchAdmin('/admin/sources', {
    method: 'POST',
    headers,
    body: form,
  });
  return _handleResponse<AddSourceResult>(res);
}

export async function addSourcesBatch(
  urlsText: string,
  depth = 1,
  tags: string[] = [],
  tagMode: 'none' | 'baseline_only' | 'auto_infer' = 'auto_infer'
): Promise<BatchAddSourcesResult> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin('/admin/sources/batch', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls_text: urlsText,
      depth,
      tags,
      tag_mode: tagMode,
    }),
  });
  return _handleResponse<BatchAddSourcesResult>(res);
}

export async function deleteSource(
  url: string
): Promise<{ status: string; chunks_deleted: number }> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin(`/admin/sources?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
    headers,
  });
  return _handleResponse(res);
}

export async function getQueue(status?: string): Promise<{ jobs: QueueJob[]; total: number }> {
  const headers = await _authHeaders();
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await _fetchAdmin(`/admin/queue${params}`, { headers });
  return _handleResponse(res);
}

export async function getQueueStatusSummary(): Promise<{
  statuses: QueueStatusSummaryItem[];
  total_jobs: number;
}> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin('/admin/queue/status-summary', { headers });
  return _handleResponse(res);
}

// ---------------------------------------------------------------------------
// Document upload
// ---------------------------------------------------------------------------

export interface UploadResult {
  status: 'ok' | 'partial';
  filename: string;
  chunks_total: number;
  chunks_inserted: number;
  tags?: string[];
  errors: string[];
}

export async function uploadDocument(file: File, tags: string[] = []): Promise<UploadResult> {
  const headers = await _authHeaders();
  // Remove Accept header so fetch doesn't interfere with multipart
  delete (headers as Record<string, string>)['Accept'];
  const form = new FormData();
  form.append('file', file);
  if (tags.length > 0) {
    form.append('tags', tags.join(','));
  }
  const res = await _fetchAdmin('/admin/upload', {
    method: 'POST',
    headers,
    body: form,
  });
  return _handleResponse<UploadResult>(res);
}

// ---------------------------------------------------------------------------
// Re-export admin stats (already in router_admin — just proxied here)
// ---------------------------------------------------------------------------

export interface AdminStats {
  total_chunks: number;
  unique_sources: number;
  avg_chunk_size: number;
  database_size_mb: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin('/admin/stats', { headers });
  return _handleResponse<AdminStats>(res);
}

export interface AdminSource {
  id?: string;
  url: string;
  domain?: string;
  source_domain?: string;
  title?: string;
  description?: string;
  author?: string;
  published_date?: string;
  first_scraped_at?: string;
  last_scraped_at?: string;
  scrape_count?: number;
  reliability_score?: string | number;
  total_chunks: number;
  total_characters?: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export async function getSources(
  page = 1,
  limit = 50
): Promise<{ sources: AdminSource[]; total: number }> {
  const headers = await _authHeaders();
  const offset = (page - 1) * limit;
  const res = await _fetchAdmin(`/admin/sources?limit=${limit}&offset=${offset}`, { headers });
  type AdminSourcePayload = Partial<AdminSource> & {
    domain?: string;
    source_domain?: string;
    chunk_count?: number;
    total_chunks?: number;
    tags?: unknown;
    metadata?: unknown;
  };

  const payload = await _handleResponse<{ sources: AdminSourcePayload[]; total: number }>(res);
  const toMetadataObject = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  };

  const sources: AdminSource[] = (payload.sources ?? []).map((item) => {
    const metadata = toMetadataObject(item.metadata);
    const metadataTags = metadata.tags;

    return {
      url: item.url ?? '',
      title: item.title,
      source_domain: item.source_domain ?? item.domain,
      domain: item.domain ?? item.source_domain,
      description: item.description,
      author: item.author,
      published_date: item.published_date,
      first_scraped_at: item.first_scraped_at,
      last_scraped_at: item.last_scraped_at,
      scrape_count: item.scrape_count ?? 0,
      reliability_score: item.reliability_score,
      total_chunks: item.total_chunks ?? item.chunk_count ?? 0,
      total_characters: item.total_characters ?? 0,
      is_active: item.is_active ?? true,
      metadata,
      tags: Array.isArray(item.tags)
        ? item.tags
        : Array.isArray(metadataTags)
          ? (metadataTags as string[])
          : [],
    };
  });
  return { sources, total: payload.total ?? sources.length };
}

export async function updateSourceTags(
  url: string,
  tags: string[],
  lang: 'en' | 'es' = 'en'
): Promise<{ status: string; chunks_updated: number; tags: string[]; message?: string }> {
  const headers = await _authHeaders();
  const params = new URLSearchParams({ lang });
  const res = await _fetchAdmin(`/admin/sources/tags?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, tags }),
  });
  return _handleResponse(res);
}

export async function getMetadataTags(
  query = '',
  limit = 100,
  lang: 'en' | 'es' = 'en'
): Promise<{ tags: string[]; total: number }> {
  const headers = await _authHeaders();
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('limit', String(limit));
  params.set('lang', lang);
  const res = await _fetchAdmin(`/admin/tags?${params.toString()}`, { headers });
  return _handleResponse(res);
}

export interface AdminModelConfigResponse {
  generation: {
    current: { provider?: string; model?: string | null; locked?: boolean };
    available: {
      providers: Array<{ key: string; label: string }>;
      models: Record<string, string[]>;
    };
  };
  embeddings: {
    current: { provider?: string; model?: string; locked?: boolean };
    available: {
      providers: Array<{ key: string; label: string }>;
      models: Record<string, string[]>;
    };
  };
}

export interface AdminModelConfigUpdateRequest {
  generation?: { provider: string; model?: string; lock?: boolean };
  embeddings?: { provider: string; model: string; lock?: boolean };
}

export async function getModelConfig(): Promise<AdminModelConfigResponse> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin('/admin/models/config', { headers });
  return _handleResponse(res);
}

  type AdminModelConfigUpdateResponse = Record<string, unknown>;

export async function updateModelConfig(
  payload: AdminModelConfigUpdateRequest
): Promise<AdminModelConfigUpdateResponse> {
  const headers = await _authHeaders();
  const res = await _fetchAdmin('/admin/models/config', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return _handleResponse<AdminModelConfigUpdateResponse>(res);
}
