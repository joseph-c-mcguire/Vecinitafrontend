# Vecinita - Guía de Inicio Rápido

## 🚀 Versión Simplificada - Sin Autenticación ni Historial

Esta es una versión simplificada del chatbot Vecinita que funciona como una aplicación de sesión única. **No requiere login ni base de datos**.

---

## ✨ Características Principales

### 💬 Chatbot RAG
- Chat interactivo con respuestas simuladas
- Atribución de fuentes con enlaces clicables
- Sistema de retroalimentación (👍/👎) para cada respuesta
- Mensajes de "pensando" animados durante la carga

### 🌐 Completamente Bilingüe
- **Español** (predeterminado) e **Inglés**
- Selector de idioma en el header
- Todas las traducciones están completas
- Preferencia guardada automáticamente

### 🎨 Temas
- **Modo Claro** y **Modo Oscuro**
- Toggle rápido en el header
- Colores VECINA (turquoise #4DB8B8)
- Preferencia guardada automáticamente

### ♿ Accesibilidad Completa
- **4 tamaños de fuente**: Pequeño, Mediano, Grande, Extra Grande
- **Modo de alto contraste**: Para mejor visibilidad
- **Reducción de movimiento**: Minimiza animaciones
- Navegación completa por teclado
- Etiquetas ARIA apropiadas
- Enlace "Saltar al contenido"

### ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Alt + N` | Nueva conversación |
| `Alt + S` | Abrir configuración del backend |
| `Alt + A` | Abrir panel de accesibilidad |
| `Alt + K` | Mostrar ayuda de atajos de teclado |
| `Alt + /` | Enfocar entrada de mensaje |
| `Enter` | Enviar mensaje |
| `Shift + Enter` | Nueva línea en el mensaje |
| `Escape` | Cerrar modal/panel abierto |
| `Tab` | Navegar hacia adelante |
| `Shift + Tab` | Navegar hacia atrás |

---

## 🎯 Cómo Usar

### Iniciar una Conversación
1. Escribe tu pregunta en el campo de texto al final de la página
2. Presiona `Enter` o haz clic en el botón de enviar
3. Espera la respuesta del asistente con fuentes citadas

### Dar Retroalimentación
1. Al final de cada respuesta del asistente, verás iconos de 👍 y 👎
2. Haz clic en uno para calificar la respuesta
3. Opcionalmente, agrega un comentario explicando tu calificación
4. La retroalimentación se guarda en tu navegador

### Cambiar Idioma
1. Haz clic en el selector de idioma en el header (🌐)
2. Selecciona "Español" o "English"
3. Toda la interfaz cambia inmediatamente

### Cambiar Tema
1. Haz clic en el icono de sol/luna en el header
2. Alterna entre modo claro y oscuro
3. La preferencia se guarda automáticamente

### Ajustar Accesibilidad
1. Haz clic en el icono de engranaje (⚙️) en el header
2. O presiona `Alt + A`
3. Ajusta:
   - Tamaño de fuente
   - Modo de alto contraste
   - Reducción de movimiento

### Configurar Backend
1. Haz clic en el icono de deslizadores en el header
2. O presiona `Alt + S`
3. Selecciona:
   - Proveedor LLM (OpenAI, Anthropic, Google, Mistral)
   - Modelo específico
   - Proveedor de embeddings
   - Modelo de embeddings específico

**Nota:** Esta configuración actualmente es solo para UI. Cuando conectes un backend real, estos valores se usarán para las llamadas API.

---

## 💾 Almacenamiento de Datos

### Todo se Guarda Localmente

Esta aplicación NO usa base de datos. Todo se almacena en `localStorage` de tu navegador:

| Dato | Clave | Persistencia |
|------|-------|--------------|
| Idioma | `vecinita-language` | ✓ |
| Tema | `vecinita-theme` | ✓ |
| Accesibilidad | `accessibility-settings` | ✓ |
| Config Backend | `vecinita-backend-settings` | ✓ |
| Retroalimentación | `vecinita_message_feedback` | ✓ |
| **Conversaciones** | ❌ | ❌ (no se guardan) |

### Privacidad
- No hay login ni registro
- No se envía nada a servidores
- No hay tracking
- Los datos nunca salen de tu navegador

---

## 🔄 Comportamiento de Sesión

### Nueva Conversación
- Haz clic en "Nuevo chat" o presiona `Alt + N`
- Se limpia la conversación actual
- Aparece un nuevo mensaje de bienvenida
- Los ajustes de tema/idioma/accesibilidad se mantienen

### Recargar Página
- Se pierden todos los mensajes actuales
- Los ajustes de configuración se mantienen
- La aplicación inicia con un nuevo mensaje de bienvenida

### Cerrar/Abrir Navegador
- Se pierden todos los mensajes
- Los ajustes de configuración se mantienen
- La retroalimentación se mantiene

---

## 🎨 Personalización Visual

### Colores
- **Turquoise primario**: `#4DB8B8` (color VECINA)
- **Modo claro**: Fondo blanco, texto negro
- **Modo oscuro**: Fondo #0f1419, texto claro
- **Alto contraste**: Blanco/negro puro con acentos brillantes

### Fuentes
- Tamaño base: 16px (ajustable)
- Sans-serif moderna
- Line-height óptimo para lectura

---

## 🔌 Próxima Integración del Backend

Actualmente, las respuestas son simuladas. Para conectar a un backend RAG real:

### 1. Crear Servicios de Backend

```typescript
// src/app/services/ragService.ts
export async function generateQueryEmbedding(
  query: string,
  options: { provider: string; model: string }
) {
  // Implementar llamada a servicio de embeddings
}

export async function searchVectorDatabase(
  embedding: number[],
  options: { threshold: number; count: number }
) {
  // Implementar búsqueda en Supabase vector DB
}

export async function callLLM(options: {
  model: string;
  provider: string;
  context: string;
  query: string;
  language: string;
}) {
  // Implementar llamada a LLM
}
```

### 2. Reemplazar getMockResponse en App.tsx

Ubicación: `/src/app/App.tsx` línea ~105

```typescript
// Cambiar esto:
const getMockResponse = (userMessage: string) => { ... }

// Por esto:
const getRagResponse = async (userMessage: string) => {
  const { settings } = useBackendSettings();
  
  // 1. Generar embedding
  const embedding = await generateQueryEmbedding(userMessage, {
    provider: settings.embeddingProvider,
    model: settings.embeddingModel
  });
  
  // 2. Buscar en vector DB
  const matches = await searchVectorDatabase(embedding, {
    threshold: 0.7,
    count: 5
  });
  
  // 3. Construir contexto
  const context = matches.map(m => m.content).join('\n\n');
  
  // 4. Llamar a LLM
  const response = await callLLM({
    model: settings.llmModel,
    provider: settings.llmProvider,
    context,
    query: userMessage,
    language
  });
  
  // 5. Construir fuentes
  const sources = matches.map((m, i) => ({
    title: m.metadata.title || `Fuente ${i + 1}`,
    url: m.metadata.url || '#',
    snippet: m.content.substring(0, 200)
  }));
  
  return { content: response, sources };
};
```

### 3. Actualizar handleSubmit

```typescript
// En handleSubmit, línea ~308
// Cambiar:
const response = getMockResponse(userMessageContent);

// Por:
const response = await getRagResponse(userMessageContent);
```

### 4. Configurar Variables de Entorno

```bash
# .env.local
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_COHERE_API_KEY=...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 📚 Documentación Adicional

- **README.md**: Información general del proyecto
- **SIMPLIFICATION_SUMMARY.md**: Detalles técnicos de los cambios realizados
- **/src/app/App.tsx**: Código principal con comentarios TODO para backend

---

## ❓ Preguntas Frecuentes

### ¿Por qué no se guardan mis conversaciones?
Esta es una versión simplificada sin base de datos. Si necesitas guardar conversaciones, deberías implementar la integración con Supabase.

### ¿Puedo agregar autenticación?
Sí, los archivos de autenticación están en el proyecto (no se importan). Puedes restaurarlos si lo necesitas.

### ¿Las respuestas son reales?
No, actualmente son respuestas simuladas/mock. Necesitas conectar un backend RAG real para respuestas dinámicas.

### ¿Funciona offline?
Sí, toda la UI funciona offline. Solo las futuras llamadas al backend necesitarán conexión.

### ¿Es seguro?
Para uso de demostración, sí. Para producción con datos sensibles, debes:
- Agregar autenticación
- Sanitizar inputs del usuario
- Implementar rate limiting
- Usar HTTPS
- Validar todas las respuestas del backend

---

## 🎉 ¡Listo para Usar!

La aplicación está completamente funcional y lista para demostrar todas las características de UI/UX mientras desarrollas la integración del backend.

**Disfruta explorando Vecinita** 🌿✨
