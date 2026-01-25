import React, { useState } from 'react';
import { X, Upload, Link as LinkIcon, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useBackendSettings } from '../context/BackendSettingsContext';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentAdded?: () => void;
}

type DocumentSource = 'url' | 'file';

export function AddDocumentModal({ isOpen, onClose, onDocumentAdded }: AddDocumentModalProps) {
  const { t, language } = useLanguage();
  const { embeddingProvider, embeddingModel } = useBackendSettings();
  
  const [source, setSource] = useState<DocumentSource>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html'
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError(language === 'es' 
          ? 'Tipo de archivo no válido. Use TXT, MD, PDF, DOCX o HTML.'
          : 'Invalid file type. Please use TXT, MD, PDF, DOCX, or HTML.');
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError(language === 'es'
          ? 'El archivo es demasiado grande. Máximo 10MB.'
          : 'File is too large. Maximum 10MB.');
        return;
      }

      setFile(selectedFile);
      setError(null);
      
      // Auto-fill title from filename if not set
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProgress('');
    
    // Validation
    if (!title.trim()) {
      setError(language === 'es' ? 'El título es requerido' : 'Title is required');
      return;
    }

    if (source === 'url') {
      if (!url.trim()) {
        setError(language === 'es' ? 'La URL es requerida' : 'URL is required');
        return;
      }
      
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        setError(language === 'es' ? 'URL no válida' : 'Invalid URL');
        return;
      }
    } else if (source === 'file') {
      if (!file) {
        setError(language === 'es' ? 'Seleccione un archivo' : 'Please select a file');
        return;
      }
    }

    setIsProcessing(true);

    try {
      // TODO: Implement actual document processing
      // See /BACKEND_IMPLEMENTATION.md Section 4.3 and 7
      // 
      // This will involve:
      // 1. Upload file to Supabase Storage (if file upload)
      // 2. Call Edge Function to scrape/extract content
      // 3. Edge Function will:
      //    - Scrape webpage or extract text from file
      //    - Chunk the content
      //    - Generate embeddings using selected model
      //    - Store in vector database
      // 4. Poll for completion or use webhooks
      
      // Simulate processing steps
      const steps = language === 'es' 
        ? [
            'Extrayendo contenido...',
            'Dividiendo en fragmentos...',
            'Generando embeddings...',
            'Almacenando en la base de datos...',
            '¡Completado!'
          ]
        : [
            'Extracting content...',
            'Chunking text...',
            'Generating embeddings...',
            'Storing in database...',
            'Complete!'
          ];

      for (let i = 0; i < steps.length; i++) {
        setProgress(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Success
      onDocumentAdded?.();
      handleClose();
      
    } catch (err) {
      setError(language === 'es' 
        ? 'Error al procesar el documento. Por favor, inténtelo de nuevo.'
        : 'Error processing document. Please try again.');
      console.error('Document processing error:', err);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setUrl('');
      setTitle('');
      setFile(null);
      setError(null);
      setProgress('');
      setSource('url');
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-labelledby="add-document-title"
        aria-modal="true"
      >
        <div className="bg-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border p-4 sm:p-6 z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="add-document-title" className="text-lg sm:text-xl text-foreground">
                    {language === 'es' ? 'Agregar Documento' : 'Add Document'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'es'
                      ? 'Agregue un documento mediante URL o carga de archivo'
                      : 'Add a document via URL or file upload'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0 disabled:opacity-50"
                aria-label={t('close')}
              >
                <X className="w-5 h-5 text-foreground" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            {/* Source Type Toggle */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                {language === 'es' ? 'Tipo de Fuente' : 'Source Type'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSource('url')}
                  disabled={isProcessing}
                  className={`p-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    source === 'url'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent text-foreground'
                  } disabled:opacity-50`}
                >
                  <LinkIcon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSource('file')}
                  disabled={isProcessing}
                  className={`p-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    source === 'file'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent text-foreground'
                  } disabled:opacity-50`}
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">{language === 'es' ? 'Archivo' : 'File'}</span>
                </button>
              </div>
            </div>

            {/* URL Input */}
            {source === 'url' && (
              <div className="space-y-2">
                <label htmlFor="document-url" className="text-sm text-muted-foreground">
                  {language === 'es' ? 'URL del Documento' : 'Document URL'}
                </label>
                <input
                  id="document-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  placeholder="https://example.com/article"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  required={source === 'url'}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'es'
                    ? 'Se extraerá el contenido de la página web automáticamente'
                    : 'Content will be automatically extracted from the webpage'}
                </p>
              </div>
            )}

            {/* File Upload */}
            {source === 'file' && (
              <div className="space-y-2">
                <label htmlFor="document-file" className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Cargar Archivo' : 'Upload File'}
                </label>
                <div className="relative">
                  <input
                    id="document-file"
                    type="file"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                    accept=".txt,.md,.pdf,.docx,.html"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer disabled:opacity-50"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" aria-hidden="true" />
                    <span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {language === 'es'
                    ? 'Formatos soportados: TXT, MD, PDF, DOCX, HTML (máx. 10MB)'
                    : 'Supported formats: TXT, MD, PDF, DOCX, HTML (max 10MB)'}
                </p>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-2">
              <label htmlFor="document-title" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Título del Documento' : 'Document Title'}
              </label>
              <input
                id="document-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isProcessing}
                placeholder={language === 'es' ? 'Ingrese un título descriptivo' : 'Enter a descriptive title'}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                required
              />
            </div>

            {/* Embedding Model Info */}
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div className="text-xs text-muted-foreground">
                  <p>
                    <strong className="text-foreground">
                      {language === 'es' ? 'Modelo de Embedding:' : 'Embedding Model:'}
                    </strong>{' '}
                    {embeddingModel}
                  </p>
                  <p className="mt-1">
                    {language === 'es'
                      ? 'El documento se procesará usando el modelo de embedding configurado actualmente.'
                      : 'Document will be processed using the currently configured embedding model.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Processing Progress */}
            {isProcessing && progress && (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{progress}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 text-foreground"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{language === 'es' ? 'Procesando...' : 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    <span>{language === 'es' ? 'Agregar Documento' : 'Add Document'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
