# Guía de Integración del Backend - Chatbot Vecinita
# Backend Integration Guide - Vecinita Chatbot

**Última actualización / Last updated**: January 25, 2026

## Tabla de Contenidos / Table of Contents

1. [Resumen General / Overview](#resumen-general--overview)
2. [Configuración de Supabase / Supabase Setup](#configuración-de-supabase--supabase-setup)
3. [Esquema de Base de Datos / Database Schema](#esquema-de-base-de-datos--database-schema)
4. [Sistema RAG / RAG System](#sistema-rag--rag-system)
5. [Sistema de Retroalimentación / Feedback System](#sistema-de-retroalimentación--feedback-system)
6. [Autenticación / Authentication](#autenticación--authentication)
7. [APIs y Endpoints / APIs and Endpoints](#apis-y-endpoints--apis-and-endpoints)
8. [Ejemplos de Código / Code Examples](#ejemplos-de-código--code-examples)

---

## Resumen General / Overview

### ES: Arquitectura del Sistema

El chatbot Vecinita utiliza una arquitectura moderna de aplicación web con:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **RAG**: Embeddings vectoriales + búsqueda semántica
- **LLMs**: Soporte para múltiples proveedores (GPT-4, Claude, etc.)

### EN: System Architecture

The Vecinita chatbot uses a modern web application architecture with:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **RAG**: Vector embeddings + semantic search
- **LLMs**: Support for multiple providers (GPT-4, Claude, etc.)

---

## Configuración de Supabase / Supabase Setup

### 1. Crear Proyecto / Create Project

1. Ve a [supabase.com](https://supabase.com) / Go to [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto / Create a new project
3. Guarda tu `SUPABASE_URL` y `SUPABASE_ANON_KEY` / Save your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### 2. Habilitar Extensión pgvector / Enable pgvector Extension

```sql
-- Ejecutar en el SQL Editor de Supabase
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Configurar Variables de Entorno / Configure Environment Variables

Actualiza `/src/lib/supabase.ts` con tus credenciales:

```typescript
const supabaseUrl = 'TU_SUPABASE_URL'; // YOUR_SUPABASE_URL
const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY'; // YOUR_SUPABASE_ANON_KEY
```

---

## Esquema de Base de Datos / Database Schema

### 1. Tabla de Sesiones de Chat / Chat Sessions Table

```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas / Index for fast lookups
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- RLS (Row Level Security)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);
```

### 2. Tabla de Historial de Chat / Chat History Table

```sql
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices / Indexes
CREATE INDEX idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at);

-- RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat history"
  ON chat_history FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own messages"
  ON chat_history FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );
```

### 3. Tabla de Documentos (RAG) / Documents Table (RAG)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices / Indexes
CREATE INDEX idx_documents_title ON documents(title);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- RLS (público para lectura, solo admin para escritura)
-- RLS (public for read, admin only for write)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view documents"
  ON documents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );
```

### 4. Tabla de Chunks de Documentos (Vectores) / Document Chunks Table (Vectors)

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002: 1536, change for other models
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice vectorial usando HNSW para búsqueda rápida
-- Vector index using HNSW for fast search
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índices adicionales / Additional indexes
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);

-- RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view document chunks"
  ON document_chunks FOR SELECT
  TO public
  USING (true);
```

### 5. Tabla de Retroalimentación de Mensajes / Message Feedback Table ✨ NEW

```sql
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating TEXT CHECK (rating IN ('positive', 'negative')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Único por mensaje y usuario / Unique per message and user
  UNIQUE(message_id, user_id)
);

-- Índices / Indexes
CREATE INDEX idx_message_feedback_session_id ON message_feedback(session_id);
CREATE INDEX idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX idx_message_feedback_rating ON message_feedback(rating);
CREATE INDEX idx_message_feedback_created_at ON message_feedback(created_at DESC);

-- RLS
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON message_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON message_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON message_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON message_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );
```

### 6. Tabla de Usuarios Admin / Admin Users Table

```sql
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin list"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );
```

---

## Sistema RAG / RAG System

### Función de Búsqueda Vectorial / Vector Search Function

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    document_chunks.metadata
  FROM document_chunks
  WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Flujo RAG Completo / Complete RAG Flow

```typescript
// 1. Generar embedding de la consulta del usuario
// 1. Generate embedding for user query
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: query,
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

// 2. Buscar chunks relevantes
// 2. Search for relevant chunks
async function searchRelevantChunks(
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 5
) {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) throw error;
  return data;
}

// 3. Construir contexto para el LLM
// 3. Build context for LLM
function buildContext(chunks: any[]): string {
  return chunks.map(chunk => chunk.content).join('\n\n');
}

// 4. Llamar al LLM con contexto
// 4. Call LLM with context
async function callLLM(params: {
  model: string;
  context: string;
  query: string;
  language: string;
}) {
  const systemPrompt = params.language === 'es'
    ? `Eres un asistente útil que responde preguntas basándote en el siguiente contexto. Si la información no está en el contexto, indica que no tienes esa información específica.

Contexto:
${params.context}`
    : `You are a helpful assistant that answers questions based on the following context. If the information is not in the context, indicate that you don't have that specific information.

Context:
${params.context}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.query },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// 5. Función RAG completa
// 5. Complete RAG function
export async function getRagResponse(
  userQuery: string,
  language: string,
  settings: BackendSettings
): Promise<{ content: string; sources: Source[] }> {
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(userQuery);
  
  // Search for relevant chunks
  const relevantChunks = await searchRelevantChunks(queryEmbedding, 0.7, 5);
  
  // Build context
  const context = buildContext(relevantChunks);
  
  // Call LLM
  const response = await callLLM({
    model: settings.llmModel,
    context,
    query: userQuery,
    language,
  });
  
  // Build sources array
  const sources: Source[] = await buildSources(relevantChunks);
  
  return { content: response, sources };
}

// 6. Construir array de fuentes
// 6. Build sources array
async function buildSources(chunks: any[]): Promise<Source[]> {
  const documentIds = [...new Set(chunks.map(c => c.document_id))];
  
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, url')
    .in('id', documentIds);
  
  return documents?.map(doc => ({
    title: doc.title,
    url: doc.url || '',
    snippet: chunks
      .filter(c => c.document_id === doc.id)
      .map(c => c.content.substring(0, 200))
      .join('... '),
  })) || [];
}
```

---

## Sistema de Retroalimentación / Feedback System

### Implementación en Frontend / Frontend Implementation

El sistema de retroalimentación está implementado en:
- `/src/app/components/MessageFeedback.tsx` - Componente de UI
- `/src/app/App.tsx` - Lógica de manejo de retroalimentación

### Guardar Retroalimentación / Save Feedback

```typescript
async function saveFeedback(feedback: Feedback) {
  const { error } = await supabase
    .from('message_feedback')
    .upsert({
      message_id: feedback.messageId,
      session_id: currentSessionId,
      user_id: user.id,
      rating: feedback.rating,
      comment: feedback.comment || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'message_id,user_id'
    });

  if (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
}
```

### Analizar Retroalimentación / Analyze Feedback

```sql
-- Ver resumen de retroalimentación / View feedback summary
SELECT 
  rating,
  COUNT(*) as count,
  COUNT(CASE WHEN comment IS NOT NULL THEN 1 END) as with_comments
FROM message_feedback
GROUP BY rating;

-- Ver retroalimentación reciente / View recent feedback
SELECT 
  mf.*,
  cs.title as session_title,
  au.email as user_email
FROM message_feedback mf
JOIN chat_sessions cs ON cs.id = mf.session_id
JOIN auth.users au ON au.id = mf.user_id
ORDER BY mf.created_at DESC
LIMIT 50;

-- Ver retroalimentación negativa para mejorar / View negative feedback for improvement
SELECT 
  mf.message_id,
  mf.comment,
  mf.created_at,
  cs.title
FROM message_feedback mf
JOIN chat_sessions cs ON cs.id = mf.session_id
WHERE mf.rating = 'negative' AND mf.comment IS NOT NULL
ORDER BY mf.created_at DESC;
```

---

## Autenticación / Authentication

### Configuración / Setup

Supabase Auth está configurado en `/src/app/context/AuthContext.tsx`.

### Registro de Usuario / User Registration

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@ejemplo.com',
  password: 'contraseña_segura',
});
```

### Inicio de Sesión / Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@ejemplo.com',
  password: 'contraseña',
});
```

### Cerrar Sesión / Sign Out

```typescript
const { error } = await supabase.auth.signOut();
```

### Usuarios Anónimos / Anonymous Users

Los usuarios anónimos pueden usar el chatbot pero:
- No se guarda historial en la base de datos
- La retroalimentación se guarda solo en localStorage
- No tienen acceso al historial de sesiones

---

## APIs y Endpoints / APIs and Endpoints

### OpenAI API

```typescript
// Embeddings
const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';

// Chat Completions
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
```

### Anthropic (Claude) API

```typescript
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
```

### Cohere API

```typescript
const COHERE_EMBED_ENDPOINT = 'https://api.cohere.ai/v1/embed';
const COHERE_GENERATE_ENDPOINT = 'https://api.cohere.ai/v1/generate';
```

---

## Ejemplos de Código / Code Examples

### Ejemplo 1: Añadir un Documento / Add a Document

```typescript
async function addDocument(
  title: string,
  content: string,
  url?: string
): Promise<string> {
  // 1. Insert document
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ title, content, url })
    .select()
    .single();

  if (docError) throw docError;

  // 2. Split content into chunks
  const chunks = splitIntoChunks(content, 500); // 500 words per chunk

  // 3. Generate embeddings for each chunk
  const chunkData = await Promise.all(
    chunks.map(async (chunkContent, index) => {
      const embedding = await generateQueryEmbedding(chunkContent);
      return {
        document_id: doc.id,
        content: chunkContent,
        embedding,
        chunk_index: index,
      };
    })
  );

  // 4. Insert chunks
  const { error: chunksError } = await supabase
    .from('document_chunks')
    .insert(chunkData);

  if (chunksError) throw chunksError;

  return doc.id;
}

function splitIntoChunks(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  
  return chunks;
}
```

### Ejemplo 2: Cargar Historial de Sesión / Load Session History

```typescript
async function loadSessionHistory(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map(msg => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    sources: msg.sources,
    timestamp: new Date(msg.created_at),
  }));
}
```

### Ejemplo 3: Obtener Estadísticas de Retroalimentación / Get Feedback Statistics

```typescript
async function getFeedbackStats() {
  const { data, error } = await supabase
    .from('message_feedback')
    .select('rating');

  if (error) throw error;

  const stats = {
    total: data.length,
    positive: data.filter(f => f.rating === 'positive').length,
    negative: data.filter(f => f.rating === 'negative').length,
  };

  stats.positiveRate = stats.total > 0 
    ? (stats.positive / stats.total) * 100 
    : 0;

  return stats;
}
```

---

## Próximos Pasos / Next Steps

1. ✅ Configurar Supabase y crear tablas
2. ✅ Implementar sistema de autenticación
3. ✅ Implementar sistema de retroalimentación
4. 🔲 Configurar API keys para LLMs y embeddings
5. 🔲 Cargar documentos iniciales
6. 🔲 Implementar flujo RAG completo
7. 🔲 Configurar monitoreo y análisis
8. 🔲 Implementar caché para embeddings
9. 🔲 Añadir rate limiting

---

## Recursos Adicionales / Additional Resources

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de pgvector](https://github.com/pgvector/pgvector)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com)

---

## Soporte / Support

Para preguntas o problemas, consulta:
- `/ARCHITECTURE_OVERVIEW.md` - Visión general de la arquitectura
- `/ADMIN_TOKEN_SETUP.md` - Configuración de autenticación admin
- `/ACCESIBILIDAD.md` - Características de accesibilidad

For questions or issues, see:
- `/ARCHITECTURE_OVERVIEW.md` - Architecture overview
- `/ADMIN_TOKEN_SETUP.md` - Admin authentication setup
- `/ACCESIBILIDAD.md` - Accessibility features
