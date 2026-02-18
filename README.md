# Vecinita - RAG Chatbot Simplificado

Asistente de información ambiental y comunitaria bilingüe (Español/Inglés) con soporte completo de accesibilidad.

## Características

### ✨ Funcionalidad Principal
- **Chatbot RAG** con atribución de fuentes y citaciones
- **Bilingüe** (Español/Inglés) con selector de idioma
- **Idioma predeterminado**: Español
- **Sistema de retroalimentación** para respuestas del chat (👍/👎 con comentarios opcionales)
- Respuestas simuladas con fuentes citadas (listo para integración con backend real)

### 🎨 Diseño
- **Tema personalizable**: Modo claro/oscuro con persistencia
- **Colores**: Esquema de colores VECINA con turquesa primario (#4DB8B8)
- Interfaz moderna y limpia
- Completamente responsivo

### ♿ Accesibilidad
- **Ajuste de tamaño de fuente**: Pequeño, Mediano, Grande, Extra Grande
- **Modo de alto contraste**: Para mejor visibilidad
- **Reducción de movimiento**: Minimiza animaciones
- Navegación completa por teclado
- Etiquetas ARIA y roles semánticos
- Enlace "Saltar al contenido principal"

### ⚙️ Configuración del Backend
- Selección de **modelo LLM** (GPT-4, Claude, etc.)
- Selección de **servicio de embeddings** (OpenAI, Cohere, HuggingFace, Voyage AI)
- Configuraciones persistentes en localStorage

### ⌨️ Atajos de Teclado
- `Alt + N`: Nueva conversación
- `Alt + S`: Abrir configuración del backend
- `Alt + A`: Abrir panel de accesibilidad
- `Alt + K`: Mostrar atajos de teclado
- `Alt + /`: Enfocar entrada de mensaje
- `Enter`: Enviar mensaje
- `Shift + Enter`: Nueva línea
- `Escape`: Cerrar modal/panel
- `Tab / Shift + Tab`: Navegación

## Lo que NO está incluido

Esta versión simplificada **no incluye**:
- ❌ Sistema de autenticación/login
- ❌ Historial de conversaciones persistente
- ❌ Integración con base de datos
- ❌ Panel de administrador
- ❌ Gestión de usuarios

Todas las preferencias del usuario (tema, idioma, accesibilidad, configuración del backend) se almacenan localmente en `localStorage`. La retroalimentación de mensajes también se guarda en `localStorage`.

## 📚 Documentación

Para más información, consulta nuestros [documentos completos](./docs/INDEX.md):

- **[QUICK_START.md](./docs/guides/QUICK_START.md)** - Guía rápida para usuarios finales
- **[CHATWIDGET_README.md](./docs/reference/CHATWIDGET_README.md)** - Integración del componente ChatWidget
- **[CONTRIBUTING.md](./docs/guides/CONTRIBUTING.md)** - Guía de desarrollo
- **[docs/INDEX.md](./docs/INDEX.md)** - Índice completo de documentación

Para información sobre accesibilidad, consulta [docs/es/ACCESIBILIDAD.md](./docs/es/ACCESIBILIDAD.md).

## Tecnologías

- **React 18** con TypeScript
- **Tailwind CSS v4** para estilos
- **Lucide React** para iconos
- **Radix UI** para componentes accesibles
- **Vite** para desarrollo y compilación

## Integración Futura del Backend

Esta aplicación está lista para conectarse a un backend RAG. La función `getMockResponse` en `/src/app/App.tsx` debe ser reemplazada con:

1. **Generación de embeddings** para la consulta del usuario
2. **Búsqueda vectorial** en base de datos Supabase
3. **Construcción de contexto** a partir de documentos coincidentes
4. **Llamada al LLM** con contexto y consulta
5. **Retorno de respuesta** con fuentes citadas

### Ejemplo de integración:

```typescript
const getRagResponse = async (userMessage: string) => {
  // 1. Generar embedding para la consulta
  const queryEmbedding = await generateQueryEmbedding(userMessage, {
    provider: settings.embeddingProvider,
    model: settings.embeddingModel
  });
  
  // 2. Buscar documentos relevantes en vector database
  const { data: matches } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 5
  });
  
  // 3. Construir contexto
  const context = matches.map(m => m.content).join('\n\n');
  
  // 4. Llamar al LLM
  const llmResponse = await callLLM({
    model: settings.llmModel,
    provider: settings.llmProvider,
    context,
    query: userMessage,
    language: language
  });
  
  // 5. Construir array de fuentes
  const sources = matches.map(m => ({
    title: m.metadata.title,
    url: m.metadata.url,
    snippet: m.content.substring(0, 200)
  }));
  
  return { content: llmResponse, sources };
};
```

## Instalación y Desarrollo

```bash
# Instalar dependencias (automático en Figma Make)
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## Estructura del Proyecto

```
/src
  /app
    /components        # Componentes React
      ChatMessage.tsx       # Componente de mensaje con fuentes
      MessageFeedback.tsx   # Sistema de retroalimentación
      SourceCard.tsx        # Tarjeta de fuente citada
      ThemeToggle.tsx       # Selector de tema
      LanguageSelector.tsx  # Selector de idioma
      AccessibilityPanel.tsx # Panel de opciones de accesibilidad
      BackendSettingsPanel.tsx # Configuración de modelos
      KeyboardShortcutsHelp.tsx # Ayuda de atajos
      SkipToContent.tsx     # Enlace de accesibilidad
    /context           # Contextos React
      LanguageContext.tsx      # Estado de idioma
      AccessibilityContext.tsx # Estado de accesibilidad
      BackendSettingsContext.tsx # Configuración del backend
    /services          # Lógica de negocio
      modelRegistry.ts  # Registro de modelos LLM/embedding
    App.tsx           # Componente principal
  /styles
    theme.css         # Variables de tema y CSS personalizado
    tailwind.css      # Configuración Tailwind
```

## Almacenamiento Local

La aplicación utiliza `localStorage` para persistir:

- `vecinita-theme`: Preferencia de tema (light/dark)
- `accessibility-settings`: Configuración de accesibilidad
- `vecinita-backend-settings`: Configuración de modelos LLM/embedding
- `vecinita_message_feedback`: Retroalimentación de mensajes

## Personalización

### Colores
Los colores principales se definen en `/src/styles/theme.css`:
- Primary: `#4DB8B8` (turquoise de VECINA)
- Los colores se ajustan automáticamente para modo oscuro y alto contraste

### Traducciones
Las traducciones se gestionan en `/src/app/context/LanguageContext.tsx`. Para agregar nuevas traducciones:

```typescript
newKey: {
  en: 'English text',
  es: 'Texto en español',
}
```

### Modelos
Los modelos LLM y de embeddings disponibles se definen en `/src/app/services/modelRegistry.ts`.

## Licencia

Este proyecto fue creado para proporcionar información ambiental y comunitaria. Vecinita proporciona información general - siempre verifica con fuentes oficiales.
