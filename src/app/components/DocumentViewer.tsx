import React from 'react';
import { X, ExternalLink, FileText, Calendar, Package } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface VectorDocument {
  id: string;
  title: string;
  source_url: string;
  chunks: number;
  created_at: string;
  last_updated: string;
}

interface DocumentViewerProps {
  document: VectorDocument | null;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const { t } = useLanguage();

  if (!document) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 w-full sm:w-[500px] lg:w-[600px] bg-card border-l border-border shadow-xl z-50 overflow-y-auto"
        role="dialog"
        aria-labelledby="document-viewer-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-3 sm:p-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="document-viewer-title" className="text-base sm:text-lg text-foreground line-clamp-2">
                  {document.title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {t('documentDetails')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0"
              aria-label={t('close')}
            >
              <X className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-6">
          {/* Source URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <label className="text-sm text-muted-foreground">{t('sourceUrl')}</label>
            </div>
            <a
              href={document.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-muted/30 rounded-lg text-sm text-primary hover:bg-muted/50 transition-colors break-all"
            >
              {document.source_url}
            </a>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm text-foreground font-medium">{t('metadata')}</h3>
            
            <div className="space-y-3">
              {/* Chunks */}
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border">
                <Package className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{t('chunks')}</div>
                  <div className="text-sm text-foreground mt-1">{document.chunks}</div>
                </div>
              </div>

              {/* Created At */}
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border">
                <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{t('createdAt')}</div>
                  <div className="text-sm text-foreground mt-1">
                    {new Date(document.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Last Updated */}
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border">
                <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{t('lastUpdated')}</div>
                  <div className="text-sm text-foreground mt-1">
                    {new Date(document.last_updated).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Document ID */}
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border">
                <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{t('documentId')}</div>
                  <div className="text-sm text-foreground mt-1 font-mono break-all">{document.id}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('language') === 'Spanish' 
                ? 'Este documento está almacenado en la base de datos vectorial y se utiliza para responder consultas relevantes.'
                : 'This document is stored in the vector database and is used to answer relevant queries.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border">
            <a
              href={document.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">{t('openSource')}</span>
            </a>
          </div>

          {/* Keyboard Shortcut */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{t('closePanel')}</span>
              <kbd className="px-2 py-1 bg-muted rounded border border-border text-foreground">
                Esc
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
