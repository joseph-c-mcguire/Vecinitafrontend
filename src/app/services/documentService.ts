import { supabase } from '@/lib/supabase';

export interface Document {
  id: string;
  user_id: string | null;
  filename: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DocumentMetadata {
  size: number;
  type: string;
  pageCount?: number;
  [key: string]: any;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

export class DocumentService {
  /**
   * Upload and process a document
   */
  static async uploadDocument(
    file: File,
    options?: {
      metadata?: DocumentMetadata;
    }
  ): Promise<Document> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Read file content
    const content = await this.extractTextFromFile(file);

    // Upload to storage
    const filePath = `${user?.id || 'anonymous'}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Store document metadata in database
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user?.id || null,
        filename: file.name,
        content: content,
        file_path: filePath,
        metadata: {
          size: file.size,
          type: file.type,
          ...options?.metadata,
        },
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Extract text from various file types
   */
  private static async extractTextFromFile(file: File): Promise<string> {
    // For now, handle text files only
    // In production, you would add PDF, DOCX parsers here
    if (file.type.startsWith('text/')) {
      return await file.text();
    }

    // Placeholder for other file types
    return `[File: ${file.name}]`;
  }

  /**
   * Get all documents for the current user
   */
  static async getDocuments(): Promise<Document[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user?.id || '')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific document
   */
  static async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: string): Promise<void> {
    // Get document first to get file path
    const doc = await this.getDocument(documentId);
    if (!doc) throw new Error('Document not found');

    // Delete from storage
    if (doc.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path]);
    }

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }

  /**
   * Perform vector search on documents
   * This is a placeholder - in production, use pgvector or similar
   */
  static async vectorSearch(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<VectorSearchResult[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Placeholder: Simple keyword search
    // In production, replace with actual vector similarity search
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user?.id || '')
      .ilike('content', `%${query}%`)
      .limit(options?.limit || 5);

    if (error) throw error;

    // Mock similarity scores
    return (
      data?.map((doc, index) => ({
        id: doc.id,
        content: doc.content,
        similarity: 0.9 - index * 0.1, // Mock decreasing similarity
        metadata: doc.metadata,
      })) || []
    );
  }

  /**
   * Generate embeddings for a text chunk
   * This is a placeholder - in production, call embedding API
   */
  static async generateEmbedding(
    text: string,
    provider: 'openai' | 'cohere' | 'huggingface' | 'voyage'
  ): Promise<number[]> {
    // Placeholder: Return mock embedding
    // In production, call the actual embedding API
    console.log(`Generating embedding with ${provider} for:`, text.substring(0, 50));
    
    // Return mock 384-dimensional embedding
    return Array(384).fill(0).map(() => Math.random());
  }

  /**
   * Chunk document for processing
   */
  static chunkDocument(
    content: string,
    options?: {
      chunkSize?: number;
      overlap?: number;
    }
  ): string[] {
    const chunkSize = options?.chunkSize || 500;
    const overlap = options?.overlap || 50;
    const chunks: string[] = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    return chunks;
  }
}
