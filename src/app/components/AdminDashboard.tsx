import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw, Trash2, Eye, FileText, Database, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { DocumentViewer } from './DocumentViewer';
import { AddDocumentModal } from './AddDocumentModal';
import { AdminLogin } from './AdminLogin';
import { supabase } from '@/lib/supabase';

interface VectorDocument {
  id: string;
  title: string;
  source_url: string;
  chunks: number;
  created_at: string;
  last_updated: string;
}

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<VectorDocument | null>(null);
  const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);

  const [documents, setDocuments] = useState<VectorDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated as admin
  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = () => {
    // Check sessionStorage for admin authentication
    const isAdmin = sessionStorage.getItem('admin_authenticated') === 'true';
    setIsAuthenticated(isAdmin);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  // If not authenticated, show admin login
  if (!isAuthenticated) {
    return <AdminLogin onAuthenticated={() => setIsAuthenticated(true)} onClose={onClose} />;
  }

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('vector_documents')
      .select('*')
      .order('last_updated', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
    } else {
      setDocuments(data || []);
    }
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDocuments();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('delete') + '?')) return;
    
    const { error } = await supabase
      .from('vector_documents')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    } else {
      setDocuments(documents.filter((doc) => doc.id !== id));
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.source_url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks, 0);

  // Handle ESC key to close document viewer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingDocument) {
        setViewingDocument(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [viewingDocument]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0"
                aria-label={t('backToChat')}
                title={t('backToChat')}
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
              </button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl text-foreground truncate">{t('adminPanel')}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('vectorDatabase')}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0"
              aria-label={t('refresh')}
              title={t('refresh')}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`w-4 h-4 sm:w-5 sm:h-5 text-foreground ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-lg bg-background">
              <div className="text-xs sm:text-sm text-muted-foreground">{t('totalDocuments')}</div>
              <div className="text-lg sm:text-2xl text-foreground mt-1">{documents.length}</div>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-background">
              <div className="text-xs sm:text-sm text-muted-foreground">{t('chunks')}</div>
              <div className="text-lg sm:text-2xl text-foreground mt-1">{totalChunks}</div>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-background">
              <div className="text-xs sm:text-sm text-muted-foreground">{t('lastUpdated')}</div>
              <div className="text-xs sm:text-sm text-foreground mt-1">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchDocuments')}
                className="w-full pl-9 pr-3 py-2 text-sm sm:text-base rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('searchDocuments')}
              />
            </div>
            <button
              className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 sm:gap-2 shrink-0"
              aria-label={t('addDocument')}
              onClick={() => setIsAddDocumentModalOpen(true)}
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              <span className="hidden sm:inline text-sm sm:text-base">{t('addDocument')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <main className="flex-1 overflow-y-auto" role="main">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm text-muted-foreground">{t('documentTitle')}</th>
                    <th className="text-left px-4 py-3 text-sm text-muted-foreground">{t('sourceUrl')}</th>
                    <th className="text-left px-4 py-3 text-sm text-muted-foreground">{t('chunks')}</th>
                    <th className="text-left px-4 py-3 text-sm text-muted-foreground">{t('lastUpdated')}</th>
                    <th className="text-left px-4 py-3 text-sm text-muted-foreground">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">{doc.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <a
                          href={doc.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors line-clamp-1"
                        >
                          {doc.source_url}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{doc.chunks}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(doc.last_updated).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingDocument(doc)}
                            className="p-1.5 rounded hover:bg-accent transition-colors"
                            aria-label={`${t('view')} ${doc.title}`}
                          >
                            <Eye className="w-4 h-4 text-foreground" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 rounded hover:bg-accent transition-colors"
                            aria-label={`${t('delete')} ${doc.title}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm text-foreground line-clamp-2">{doc.title}</h3>
                        <a
                          href={doc.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 block mt-1"
                        >
                          {doc.source_url}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewingDocument(doc)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        aria-label={`${t('view')} ${doc.title}`}
                      >
                        <Eye className="w-4 h-4 text-foreground" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        aria-label={`${t('delete')} ${doc.title}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{doc.chunks} {t('chunks').toLowerCase()}</span>
                    <span>•</span>
                    <span>{new Date(doc.last_updated).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {filteredDocuments.length === 0 && (
              <div className="p-8 text-center">
                <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No documents found' : 'No documents in database'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          onClose={() => setViewingDocument(null)}
        />
      )}

      {/* Add Document Modal */}
      {isAddDocumentModalOpen && (
        <AddDocumentModal
          isOpen={isAddDocumentModalOpen}
          onClose={() => setIsAddDocumentModalOpen(false)}
          onDocumentAdded={handleRefresh}
        />
      )}
    </div>
  );
}