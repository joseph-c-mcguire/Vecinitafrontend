/**
 * AdminDashboard — auth-gated page at /admin.
 *
 * Three tabs:
 *  1. Sources  — list, add (URL + depth), delete
 *  2. Upload   — drag-and-drop file → embed → ingest
 *  3. Queue    — scraper job queue with auto-refresh
 *
 * Requires isAdmin === true (Supabase app_metadata.role === "admin").
 * Redirects to / if not authenticated.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2,
  Trash2,
  RefreshCw,
  Upload,
  List,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  PlusCircle,
  AlertTriangle,
  Pencil,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  addSource,
  deleteSource,
  getQueue,
  uploadDocument,
  getSources,
  getMetadataTags,
  updateSourceTags,
  getModelConfig,
  updateModelConfig,
  getQueueStatusSummary,
  type QueueJob,
  type QueueStatusSummaryItem,
} from '../services/adminService';

// ── helpers ---------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        active
          ? 'bg-card border border-b-card text-foreground -mb-px'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: QueueJob['status'] }) {
  const map: Record<QueueJob['status'], { icon: React.ReactNode; cls: string }> = {
    pending: { icon: <Clock size={12} />, cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    running: { icon: <Loader2 size={12} className="animate-spin" />, cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    processing: { icon: <Loader2 size={12} className="animate-spin" />, cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    done: { icon: <CheckCircle2 size={12} />, cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    completed: { icon: <CheckCircle2 size={12} />, cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    failed: { icon: <XCircle size={12} />, cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  };
  const { icon, cls } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {icon}
      {status}
    </span>
  );
}

// ── Sources tab -----------------------------------------------------------

interface SourceRow {
  url: string;
  title?: string;
  total_chunks: number;
  source_domain?: string;
  tags?: string[];
}

function normalizeTagsFromInput(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function tagsToText(tags?: string[]) {
  return (tags ?? []).join(', ');
}

function SourcesTab() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [adding, setAdding] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editingTagsText, setEditingTagsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSources(1, 100);
      setSources(data.sources ?? []);
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const result = await getMetadataTags('', 100);
        if (!cancelled) setTagSuggestions(result.tags ?? []);
      } catch {
        if (!cancelled) setTagSuggestions([]);
      }
    };
    loadTags();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const normalizedTags = normalizeTagsFromInput(tagsText);
      await addSource(url.trim(), depth, normalizedTags);
      setMessage({ text: `Queued: ${url}`, ok: true });
      setUrl('');
      setTagsText('');
      await load();
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setAdding(false);
    }
  };

  const startEditTags = (source: SourceRow) => {
    setEditingUrl(source.url);
    setEditingTagsText(tagsToText(source.tags));
  };

  const handleSaveTags = async (sourceUrl: string) => {
    setMessage(null);
    try {
      const normalizedTags = normalizeTagsFromInput(editingTagsText);
      const result = await updateSourceTags(sourceUrl, normalizedTags);
      setMessage({ text: `Updated ${result.chunks_updated} chunks with tags.`, ok: true });
      setEditingUrl(null);
      setEditingTagsText('');
      await load();
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    }
  };

  const handleDelete = async (sourceUrl: string) => {
    if (!confirm(`Delete all chunks for:\n${sourceUrl}`)) return;
    setDeletingUrl(sourceUrl);
    setMessage(null);
    try {
      const res = await deleteSource(sourceUrl);
      setMessage({ text: `Deleted ${res.chunks_deleted} chunks.`, ok: true });
      await load();
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add source form */}
      <form onSubmit={handleAdd} className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="font-medium text-sm">Add New Source</h3>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none"
            title="Crawl depth"
          >
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={d}>Depth {d}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Add
          </button>
        </div>
        <div className="space-y-1">
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            list="admin-tag-suggestions"
            placeholder="Tags (comma separated, optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="text-xs text-muted-foreground">Autocomplete from existing tags. You can add custom tags.</p>
        </div>
        <datalist id="admin-tag-suggestions">
          {tagSuggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </form>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
            message.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {message.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {/* Source list */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
          <span className="text-sm font-medium">{sources.length} sources</span>
          <button onClick={load} className="p-1 rounded hover:bg-accent transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
            <tr>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Tags</th>
              <th className="px-4 py-2 text-right">Chunks</th>
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && sources.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No sources yet.</td></tr>
            )}
            {sources.map((s) => (
              <tr key={s.url} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link2 size={12} className="text-muted-foreground shrink-0" />
                    <span className="truncate max-w-xs font-medium">{s.title || s.source_domain || s.url.split('/')[2]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5 pl-4">{s.url}</p>
                </td>
                <td className="px-4 py-3">
                  {editingUrl === s.url ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTagsText}
                        onChange={(e) => setEditingTagsText(e.target.value)}
                        list="admin-tag-suggestions"
                        className="w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        onClick={() => handleSaveTags(s.url)}
                        className="rounded border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground truncate block max-w-56" title={tagsToText(s.tags)}>
                      {s.tags?.length ? s.tags.join(', ') : '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">{s.total_chunks}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => startEditTags(s)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Edit tags"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.url)}
                      disabled={deletingUrl === s.url}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title="Delete chunks"
                    >
                      {deletingUrl === s.url
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Upload tab ------------------------------------------------------------

function UploadTab() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      try {
        const result = await getMetadataTags('', 100);
        if (!cancelled) setTagSuggestions(result.tags ?? []);
      } catch {
        if (!cancelled) setTagSuggestions([]);
      }
    };
    loadTags();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const normalizedTags = normalizeTagsFromInput(tagsText);
      const res = await uploadDocument(file, normalizedTags);
      setResult({ text: `Uploaded: ${res.chunks_inserted ?? '?'} chunks inserted.`, ok: true });
      setFile(null);
      setTagsText('');
    } catch (e) {
      setResult({ text: String(e), ok: false });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {file ? file.name : 'Drop a file here or click to select'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, TXT, HTML, Markdown — max 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.html,.htm,.md"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      {file && (
        <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
          <div className="text-sm">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown type'}</p>
          </div>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            list="upload-tag-suggestions"
            placeholder="Tags (comma separated, optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <datalist id="upload-tag-suggestions">
            {tagSuggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload & Embed'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          result.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {result.text}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Uploaded files are chunked (1000 chars / 200 overlap), embedded, and inserted into Chroma automatically.
        Use the Queue tab to monitor progress for URL-based sources.
      </p>
    </div>
  );
}

// ── Queue tab -------------------------------------------------------------

function QueueTab() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [summary, setSummary] = useState<QueueStatusSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    try {
      const [data, summaryData] = await Promise.all([
        getQueue(statusFilter || undefined),
        getQueueStatusSummary(),
      ]);
      setJobs(data.jobs ?? []);
      setSummary(summaryData.statuses ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => { setLoading(true); load(); }, [statusFilter]);

  // Auto-refresh every 10 s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh 10 s
          </label>
          <button onClick={() => { setLoading(true); load(); }} className="p-1 rounded hover:bg-accent transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <div key={item.status} className="rounded-lg border bg-card px-3 py-2 text-xs">
              <p className="text-muted-foreground uppercase tracking-wide">{item.status}</p>
              <p className="text-base font-semibold">{item.job_count}</p>
              <p className="text-muted-foreground">
                Chunks: {item.total_chunks_processed ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Job table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-center">Type</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2 text-center">Progress</th>
              <th className="px-4 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No jobs.</td></tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs truncate max-w-xs">{job.url || job.file_path || '—'}</td>
                <td className="px-4 py-3 text-center uppercase text-xs text-muted-foreground">{job.job_type || 'file'}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                  {job.total_chunks ? `${job.chunks_processed ?? 0}/${job.total_chunks}` : `${job.chunks_processed ?? 0}`}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(job.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.some((j) => j.status === 'failed') && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            Failed jobs:
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {jobs.filter((j) => j.status === 'failed').map((j) => (
                <li key={j.id}><span className="font-mono">{j.url || j.file_path}</span>{j.error ? ` — ${j.error}` : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [generationProvider, setGenerationProvider] = useState('');
  const [generationModel, setGenerationModel] = useState('');
  const [embeddingProvider, setEmbeddingProvider] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [generationOptions, setGenerationOptions] = useState<{ providers: Array<{ key: string; label: string }>; models: Record<string, string[]> }>({ providers: [], models: {} });
  const [embeddingOptions, setEmbeddingOptions] = useState<{ providers: Array<{ key: string; label: string }>; models: Record<string, string[]> }>({ providers: [], models: {} });

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const config = await getModelConfig();
      setGenerationOptions(config.generation?.available ?? { providers: [], models: {} });
      setEmbeddingOptions(config.embeddings?.available ?? { providers: [], models: {} });
      const nextGenerationProvider = config.generation?.current?.provider ?? '';
      const generationModels = nextGenerationProvider
        ? (config.generation?.available?.models?.[nextGenerationProvider] ?? [])
        : [];
      const nextGenerationModel = config.generation?.current?.model ?? '';

      const nextEmbeddingProvider = config.embeddings?.current?.provider ?? '';
      const embeddingModels = nextEmbeddingProvider
        ? (config.embeddings?.available?.models?.[nextEmbeddingProvider] ?? [])
        : [];
      const nextEmbeddingModel = config.embeddings?.current?.model ?? '';

      setGenerationProvider(nextGenerationProvider);
      setGenerationModel(generationModels.includes(nextGenerationModel) ? nextGenerationModel : (generationModels[0] ?? ''));
      setEmbeddingProvider(nextEmbeddingProvider);
      setEmbeddingModel(embeddingModels.includes(nextEmbeddingModel) ? nextEmbeddingModel : (embeddingModels[0] ?? ''));
    } catch (error) {
      setMessage({ text: String(error), ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generationModels = generationProvider ? (generationOptions.models[generationProvider] ?? []) : [];
  const embeddingModels = embeddingProvider ? (embeddingOptions.models[embeddingProvider] ?? []) : [];

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateModelConfig({
        generation: generationProvider ? { provider: generationProvider, model: generationModel || undefined } : undefined,
        embeddings: embeddingProvider && embeddingModel ? { provider: embeddingProvider, model: embeddingModel } : undefined,
      });
      setMessage({ text: 'Model configuration updated.', ok: true });
      await load();
    } catch (error) {
      setMessage({ text: String(error), ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading model settings…</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-4 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">Model Configuration</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Generation Model</p>
          <select
            value={generationProvider}
            onChange={(e) => {
              const provider = e.target.value;
              setGenerationProvider(provider);
              const models = generationOptions.models[provider] ?? [];
              setGenerationModel(models[0] ?? '');
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select provider</option>
            {generationOptions.providers.map((provider) => (
              <option key={provider.key} value={provider.key}>{provider.label}</option>
            ))}
          </select>
          <select
            value={generationModel}
            onChange={(e) => setGenerationModel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!generationProvider || generationModels.length === 0}
          >
            <option value="">Select model</option>
            {generationModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Embedding Model</p>
          <select
            value={embeddingProvider}
            onChange={(e) => {
              const provider = e.target.value;
              setEmbeddingProvider(provider);
              const models = embeddingOptions.models[provider] ?? [];
              setEmbeddingModel(models[0] ?? '');
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select provider</option>
            {embeddingOptions.providers.map((provider) => (
              <option key={provider.key} value={provider.key}>{provider.label}</option>
            ))}
          </select>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!embeddingProvider || embeddingModels.length === 0}
          >
            <option value="">Select model</option>
            {embeddingModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <p className={`rounded-md px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
        Save model settings
      </button>
    </form>
  );
}

// ── Page -----------------------------------------------------------------

type Tab = 'sources' | 'upload' | 'queue' | 'models';

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('sources');

  // Redirect to home if not admin
  useEffect(() => {
    if (user !== undefined && !isAdmin) {
      navigate('/login?redirect=/admin', { replace: true });
    }
  }, [user, isAdmin, navigate]);

  if (!user || !isAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Checking permissions…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground mt-1">Manage corpus sources, upload documents, and monitor the scraper queue.</p>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        <TabButton active={tab === 'sources'} onClick={() => setTab('sources')}>
          <span className="flex items-center gap-1.5"><List size={14} />Sources</span>
        </TabButton>
        <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
          <span className="flex items-center gap-1.5"><Upload size={14} />Upload</span>
        </TabButton>
        <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
          <span className="flex items-center gap-1.5"><Clock size={14} />Queue</span>
        </TabButton>
        <TabButton active={tab === 'models'} onClick={() => setTab('models')}>
          <span className="flex items-center gap-1.5"><Cpu size={14} />Models</span>
        </TabButton>
      </div>

      <div>
        {tab === 'sources' && <SourcesTab />}
        {tab === 'upload' && <UploadTab />}
        {tab === 'queue' && <QueueTab />}
        {tab === 'models' && <ModelSettingsTab />}
      </div>
    </main>
  );
}
