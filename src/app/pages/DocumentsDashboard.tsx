import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link2, Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function resolveApiBase(
  rawUrl: string,
  locationOverride?: { hostname: string; protocol: string }
): string {
  const trimmedUrl = (rawUrl || '').trim().replace(/\/+$/, '');

  if (typeof window === 'undefined' && !locationOverride) {
    return trimmedUrl || rawUrl;
  }

  const runtimeLocation = locationOverride ?? window.location;
  const currentHost = runtimeLocation.hostname;
  const isCurrentHostLocal =
    currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';
  const inferredGatewayHost =
    currentHost.endsWith('.onrender.com') && currentHost.includes('-frontend')
      ? currentHost.replace('-frontend', '-gateway')
      : currentHost;

  if (isCurrentHostLocal) {
    return trimmedUrl || rawUrl;
  }

  if (trimmedUrl.startsWith('/')) {
    if (inferredGatewayHost !== currentHost) {
      return `${runtimeLocation.protocol}//${inferredGatewayHost}${trimmedUrl}`;
    }
    return trimmedUrl;
  }

  try {
    const parsed = new URL(trimmedUrl || rawUrl);
    const isRenderHost = parsed.hostname.endsWith('.onrender.com');
    const isRenderAgentHost = isRenderHost && parsed.hostname.includes('-agent');
    const isRenderGatewayHost = isRenderHost && parsed.hostname.includes('-gateway');
    const isConfiguredLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    const isGatewayPort = parsed.port === '8004' || parsed.port === '18004';
    const isStaleAbsoluteHost = parsed.hostname !== currentHost;

    const normalizeGatewayPath = () => {
      const path = parsed.pathname.replace(/\/+$/, '');
      if (!path || path === '/' || path === '/api') {
        parsed.pathname = '/api/v1';
      }
    };

    // If frontend is configured to call a direct agent host on Render,
    // rewrite to the public gateway host because documents endpoints live on gateway.
    if (isRenderAgentHost) {
      parsed.hostname = parsed.hostname.replace('-agent', '-gateway');
      parsed.protocol = 'https:';
      parsed.port = '';
      normalizeGatewayPath();
      return parsed.toString().replace(/\/+$/, '');
    }

    // Ensure hosted gateway URLs always include an API prefix.
    if (isRenderGatewayHost) {
      parsed.protocol = 'https:';
      parsed.port = '';
      normalizeGatewayPath();
      return parsed.toString().replace(/\/+$/, '');
    }

    if (isConfiguredLocal || (isGatewayPort && isStaleAbsoluteHost)) {
      parsed.hostname = inferredGatewayHost;
      // Render-hosted services terminate TLS on the default port.
      if (inferredGatewayHost.endsWith('.onrender.com')) {
        parsed.protocol = 'https:';
        parsed.port = '';
      }
      return parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    return trimmedUrl || rawUrl;
  }

  return trimmedUrl || rawUrl;
}

const API_BASE = resolveApiBase(
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ||
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
    (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8004/api/v1')
);

interface Source {
  url: string;
  title?: string;
  source_domain?: string;
  tags?: string[];
  download_url?: string;
  downloadable?: boolean;
}

interface Overview {
  sources: Source[];
}

interface TagStat {
  tag: string;
  source_count: number;
}

interface TagStatsResponseRow {
  tag: string;
  source_count?: number;
}

async function parseJsonResponseOrThrow<T>(response: Response, endpointLabel: string): Promise<T> {
  const contentType = response.headers?.get?.('content-type')?.toLowerCase() || '';
  const looksJson = contentType.includes('application/json');

  if (contentType && !looksJson) {
    throw new Error(
      `${endpointLabel} returned non-JSON response (content-type: ${contentType || 'unknown'}). ` +
        'Check gateway URL configuration.'
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${endpointLabel} returned malformed JSON. Check gateway URL configuration.`);
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function DocumentsDashboard() {
  const { t } = useLanguage();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/documents/overview`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return parseJsonResponseOrThrow<Overview>(r, '/documents/overview');
      }),
      fetch(`${API_BASE}/documents/tags?limit=100`).then((r) => {
        if (!r.ok) {
          return { tags: [] };
        }
        return parseJsonResponseOrThrow<{ tags?: TagStatsResponseRow[] }>(r, '/documents/tags');
      }),
    ])
      .then(([overviewData, tagsData]) => {
        setOverview(overviewData);
        setTagStats(
          ((tagsData.tags ?? []) as TagStatsResponseRow[]).map((row) => ({
            tag: row.tag,
            source_count: row.source_count ?? 0,
          }))
        );
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filteredSources = useMemo(() => {
    if (!overview) return [];
    return overview.sources.filter((source) => {
      const query = search.trim().toLowerCase();
      const searchable =
        `${source.url} ${source.title ?? ''} ${source.source_domain ?? ''}`.toLowerCase();
      if (query && !searchable.includes(query)) {
        return false;
      }

      if (selectedTags.length === 0) {
        return true;
      }

      const sourceTags = new Set((source.tags ?? []).map((tag) => tag.toLowerCase()));
      return selectedTags.some((tag) => sourceTags.has(tag.toLowerCase()));
    });
  }, [overview, search, selectedTags]);

  const resolveDownloadUrl = async (source: Source): Promise<string> => {
    if (source.download_url) {
      return source.download_url;
    }

    const response = await fetch(
      `${API_BASE}/documents/download-url?source_url=${encodeURIComponent(source.url)}`
    );
    if (!response.ok) {
      throw new Error(`${t('docsDownloadError')} (HTTP ${response.status})`);
    }

    const payload = await parseJsonResponseOrThrow<{ download_url?: string }>(
      response,
      '/documents/download-url'
    );
    if (!payload.download_url) {
      throw new Error(t('docsNoDownloadAvailable'));
    }

    return payload.download_url;
  };

  const handleDownload = async (source: Source) => {
    try {
      setDownloadingUrl(source.url);
      const url = await resolveDownloadUrl(source);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      alert(downloadError instanceof Error ? downloadError.message : t('docsDownloadFailed'));
    } finally {
      setDownloadingUrl(null);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">{t('docsLoading')}</p>
      </main>
    );
  }

  if (error || !overview) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-destructive">
          {t('docsLoadFailed')}: {error ?? t('docsUnknownError')}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('documentsTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('documentsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('docsTotalSources')} value={overview.sources.length} />
        <StatCard label={t('docsTotalTopics')} value={tagStats.length} />
        <StatCard label={t('docsVisibleResources')} value={filteredSources.length} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <h2 className="text-lg font-semibold">{t('docsResources')}</h2>
          <input
            type="search"
            placeholder={t('docsSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t('docsTopics')}</p>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                {t('docsClearFilters')}
              </button>
            )}
          </div>

          {tagStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('docsNoTopics')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tagStats.map((item) => {
                const selected = selectedTags.includes(item.tag);
                return (
                  <button
                    key={item.tag}
                    onClick={() => toggleTag(item.tag)}
                    className={`rounded-full border px-2 py-1 text-xs transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                    title={`${item.source_count} ${t('docsSourcesLabel')}`}
                  >
                    {item.tag} ({item.source_count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t('docsResource')}</th>
                <th className="px-4 py-3 text-center w-48">{t('docsActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSources.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-muted-foreground">
                    {t('docsNoResults')}
                  </td>
                </tr>
              )}
              {filteredSources.map((source) => (
                <tr key={source.url} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link2 size={14} className="text-muted-foreground shrink-0" />
                      {source.url.startsWith('http') ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary font-medium flex items-center gap-1 truncate max-w-sm"
                        >
                          {source.title || source.source_domain || source.url.split('/')[2]}
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-primary font-medium truncate max-w-sm block">
                          {source.title || source.source_domain || source.url}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5 pl-6">
                      {source.url}
                    </p>
                    {(source.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pl-6">
                        {(source.tags ?? []).slice(0, 6).map((tag) => (
                          <span
                            key={`${source.url}-${tag}`}
                            className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {source.url.startsWith('http') && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border px-2 py-1 text-xs hover:bg-accent"
                        >
                          {t('docsOpenSource')}
                        </a>
                      )}
                      {!source.url.startsWith('http') &&
                        (source.downloadable || source.download_url) && (
                          <button
                            onClick={() => handleDownload(source)}
                            disabled={downloadingUrl === source.url}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            <Download size={12} />
                            {downloadingUrl === source.url ? '…' : t('docsDownload')}
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
