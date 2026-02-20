/**
 * DocumentsDashboard — public page at /documents.
 *
 * Shows:
 * - Stat cards: total chunks, unique sources, embedding model, avg chunk size
 * - Source table with click-to-preview drawer
 *
 * No auth required.
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Database, Layers, Cpu, AlignLeft } from 'lucide-react';

const API_BASE =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ||
  (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8004/api/v1');

interface Source {
  url: string;
  title?: string;
  source_domain?: string;
  total_chunks: number;
  is_active?: boolean;
  download_url?: string;
  downloadable?: boolean;
  tags?: string[];
}

interface Overview {
  total_chunks: number;
  unique_sources: number;
  avg_chunk_size: number;
  embedding_model: string;
  embedding_dimension: number;
  sources: Source[];
}

interface ChunkPreview {
  chunk_index: number;
  chunk_size: number;
  content_preview: string;
  document_title: string;
}

interface DomainChunkStat {
  source_domain: string;
  chunk_count: number;
  avg_chunk_size: number;
  total_size: number;
  document_count: number;
  latest_chunk: string;
}

interface TagStat {
  tag: string;
  source_count: number;
  chunk_count: number;
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
      <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ── Preview drawer ──────────────────────────────────────────────────────────

function SourcePreviewDrawer({ source, onClose }: { source: Source; onClose: () => void }) {
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/documents/preview?source_url=${encodeURIComponent(source.url)}&limit=3`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setChunks(d.chunks ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source.url]);

  return (
    <div className="mt-2 rounded-xl border bg-muted/40 p-4 space-y-3 animate-in fade-in slide-in-from-top-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate max-w-xs">{source.title || source.url}</p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close ✕
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading preview…</p>
      ) : chunks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chunks found.</p>
      ) : (
        chunks.map((c) => (
          <div key={c.chunk_index} className="rounded-lg bg-background border p-3">
            <p className="text-xs text-muted-foreground mb-1">
              Chunk {c.chunk_index + 1} · {c.chunk_size} chars
            </p>
            <p className="text-sm leading-relaxed line-clamp-4">{c.content_preview}</p>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DocumentsDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [domainStats, setDomainStats] = useState<DomainChunkStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'any' | 'all'>('any');
  const [sortBy, setSortBy] = useState<'chunks_desc' | 'chunks_asc' | 'source_asc'>('chunks_desc');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/documents/overview`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`${API_BASE}/documents/chunk-statistics?limit=8`).then((r) => {
        if (!r.ok) {
          return { rows: [] };
        }
        return r.json();
      }),
      fetch(`${API_BASE}/documents/tags?limit=100`).then((r) => {
        if (!r.ok) {
          return { tags: [] };
        }
        return r.json();
      }),
    ])
      .then(([overviewData, statsData, tagsData]) => {
        setOverview(overviewData);
        setDomainStats(statsData.rows ?? []);
        setTagStats(tagsData.tags ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading corpus data…</p>
      </main>
    );
  }

  if (error || !overview) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-destructive">Failed to load: {error ?? 'Unknown error'}</p>
      </main>
    );
  }

  const filtered = overview.sources.filter((s) => {
    const q = search.toLowerCase();
    const searchMatch = !q || (s.url + (s.title ?? '') + (s.source_domain ?? '')).toLowerCase().includes(q);
    if (!searchMatch) return false;

    if (selectedTags.length === 0) return true;
    const sourceTags = new Set((s.tags ?? []).map((tag) => tag.toLowerCase()));
    if (sourceTags.size === 0) return false;

    if (tagMatchMode === 'all') {
      return selectedTags.every((tag) => sourceTags.has(tag.toLowerCase()));
    }
    return selectedTags.some((tag) => sourceTags.has(tag.toLowerCase()));
  });

  const filteredAndSorted = [...filtered].sort((a, b) => {
    if (sortBy === 'chunks_asc') {
      return (a.total_chunks ?? 0) - (b.total_chunks ?? 0);
    }
    if (sortBy === 'source_asc') {
      const aKey = (a.title || a.source_domain || a.url).toLowerCase();
      const bKey = (b.title || b.source_domain || b.url).toLowerCase();
      return aKey.localeCompare(bKey);
    }
    return (b.total_chunks ?? 0) - (a.total_chunks ?? 0);
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const resolveDownloadUrl = async (source: Source): Promise<string> => {
    if (source.download_url) {
      return source.download_url;
    }
    const response = await fetch(`${API_BASE}/documents/download-url?source_url=${encodeURIComponent(source.url)}`);
    if (!response.ok) {
      throw new Error(`Unable to resolve download URL (HTTP ${response.status})`);
    }
    const payload = await response.json();
    if (!payload.download_url) {
      throw new Error('No download URL is available for this document.');
    }
    return payload.download_url;
  };

  const handleDownload = async (source: Source) => {
    try {
      setDownloadingUrl(source.url);
      const url = await resolveDownloadUrl(source);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to download document');
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground mt-1">
          Public knowledge base — content currently indexed in the corpus.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Database} label="Total Chunks" value={overview.total_chunks.toLocaleString()} />
        <StatCard icon={Layers} label="Unique Sources" value={overview.unique_sources} />
        <StatCard icon={Cpu} label="Embedding Model" value={overview.embedding_model.split('/').pop() ?? overview.embedding_model} />
        <StatCard icon={AlignLeft} label="Avg Chunk Size" value={`${overview.avg_chunk_size} chars`} />
      </div>

      {/* Source table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <h2 className="text-lg font-semibold">Sources</h2>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Filter sources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'chunks_desc' | 'chunks_asc' | 'source_asc')}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="chunks_desc">Chunks ↓</option>
              <option value="chunks_asc">Chunks ↑</option>
              <option value="source_asc">Source A–Z</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Tags</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Match</span>
              <select
                value={tagMatchMode}
                onChange={(e) => setTagMatchMode(e.target.value as 'any' | 'all')}
                className="rounded-md border bg-background px-2 py-1"
              >
                <option value="any">Any</option>
                <option value="all">All</option>
              </select>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="rounded border px-2 py-1 hover:bg-accent"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {tagStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags found yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tagStats.map((item) => {
                const selected = selectedTags.includes(item.tag);
                return (
                  <button
                    key={item.tag}
                    onClick={() => toggleTag(item.tag)}
                    className={`rounded-full border px-2 py-1 text-xs transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                    title={`${item.source_count} sources, ${item.chunk_count} chunks`}
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
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-right">Chunks</th>
                <th className="px-4 py-3 text-center w-10">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    No sources match your filter.
                  </td>
                </tr>
              )}
              {filteredAndSorted.map((source) => (
                <React.Fragment key={source.url}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
                      <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
                        {source.url}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{source.total_chunks}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        {!source.url.startsWith('http') && (source.downloadable || source.download_url) && (
                          <button
                            onClick={() => handleDownload(source)}
                            disabled={downloadingUrl === source.url}
                            className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            {downloadingUrl === source.url ? '…' : 'Download'}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setExpandedUrl((prev) => (prev === source.url ? null : source.url))
                          }
                          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
                          aria-label="Toggle preview"
                        >
                          {expandedUrl === source.url ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUrl === source.url && (
                    <tr>
                      <td colSpan={3} className="px-4 pb-3">
                        <SourcePreviewDrawer
                          source={source}
                          onClose={() => setExpandedUrl(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {domainStats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Top Source Domains</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Domain</th>
                  <th className="px-4 py-3 text-right">Chunks</th>
                  <th className="px-4 py-3 text-right">Avg Chunk</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {domainStats.map((row) => (
                  <tr key={row.source_domain} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{row.source_domain}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.chunk_count}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{Math.round(Number(row.avg_chunk_size || 0))} chars</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
