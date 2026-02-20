/**
 * Admin Service — typed API client for all admin write endpoints.
 *
 * All methods require a valid Supabase session token (Bearer).
 * The token is read from the current Supabase auth session automatically.
 */

import { supabase, isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';

const DEV_ADMIN_ENABLED = (import.meta.env.VITE_DEV_ADMIN_ENABLED || 'false').toLowerCase() === 'true';
const DEV_ADMIN_STORAGE_KEY = 'vecinita-dev-admin-session';

const API_BASE =
  import.meta.env.VITE_GATEWAY_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8004/api/v1');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _getToken(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    if (DEV_ADMIN_ENABLED) {
      const raw = localStorage.getItem(DEV_ADMIN_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { token?: string };
          if (parsed.token) {
            return parsed.token;
          }
        } catch {
          localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
        }
      }
    }
    throw new Error(supabaseConfigError);
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in.');
  }
  return session.access_token;
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
}

export async function addSource(url: string, depth = 1, tags: string[] = []): Promise<AddSourceResult> {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('url', url);
  form.append('depth', String(depth));
  if (tags.length > 0) {
    form.append('tags', tags.join(','));
  }
  // Remove Content-Type header — browser sets it with the correct boundary for FormData
  delete (headers as Record<string, string>)['Content-Type'];
  const res = await fetch(`${API_BASE}/admin/sources`, {
    method: 'POST',
    headers,
    body: form,
  });
  return _handleResponse<AddSourceResult>(res);
}

export async function deleteSource(url: string): Promise<{ status: string; chunks_deleted: number }> {
  const headers = await _authHeaders();
  const res = await fetch(
    `${API_BASE}/admin/sources?url=${encodeURIComponent(url)}`,
    { method: 'DELETE', headers },
  );
  return _handleResponse(res);
}

export async function getQueue(
  status?: string,
): Promise<{ jobs: QueueJob[]; total: number }> {
  const headers = await _authHeaders();
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/admin/queue${params}`, { headers });
  return _handleResponse(res);
}

export async function getQueueStatusSummary(): Promise<{ statuses: QueueStatusSummaryItem[]; total_jobs: number }> {
  const headers = await _authHeaders();
  const res = await fetch(`${API_BASE}/admin/queue/status-summary`, { headers });
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
  const res = await fetch(`${API_BASE}/admin/upload`, {
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
  const res = await fetch(`${API_BASE}/admin/stats`, { headers });
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

export async function getSources(page = 1, limit = 50): Promise<{ sources: AdminSource[]; total: number }> {
  const headers = await _authHeaders();
  const offset = (page - 1) * limit;
  const res = await fetch(`${API_BASE}/admin/sources?limit=${limit}&offset=${offset}`, { headers });
  const payload = await _handleResponse<{ sources: any[]; total: number }>(res);
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

  const sources = (payload.sources ?? []).map((item) => ({
    ...item,
    metadata: toMetadataObject(item.metadata),
    domain: item.domain ?? item.source_domain,
    source_domain: item.source_domain ?? item.domain,
    total_chunks: item.total_chunks ?? item.chunk_count ?? 0,
    is_active: item.is_active ?? true,
    scrape_count: item.scrape_count ?? 0,
    total_characters: item.total_characters ?? 0,
    tags: Array.isArray(item.tags)
      ? item.tags
      : Array.isArray(toMetadataObject(item.metadata).tags)
        ? (toMetadataObject(item.metadata).tags as string[])
        : [],
  }));
  return { sources, total: payload.total ?? sources.length };
}

export async function updateSourceTags(url: string, tags: string[]): Promise<{ status: string; chunks_updated: number; tags: string[] }> {
  const headers = await _authHeaders();
  const res = await fetch(`${API_BASE}/admin/sources/tags`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, tags }),
  });
  return _handleResponse(res);
}

export async function getMetadataTags(query = '', limit = 100): Promise<{ tags: string[]; total: number }> {
  const headers = await _authHeaders();
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE}/admin/tags?${params.toString()}`, { headers });
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
  const res = await fetch(`${API_BASE}/admin/models/config`, { headers });
  return _handleResponse(res);
}

export async function updateModelConfig(payload: AdminModelConfigUpdateRequest): Promise<any> {
  const headers = await _authHeaders();
  const res = await fetch(`${API_BASE}/admin/models/config`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return _handleResponse(res);
}
