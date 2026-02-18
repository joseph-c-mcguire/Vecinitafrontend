import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'es';

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

const translations: Translations = {
  appTitle: {
    en: 'Vecinita',
    es: 'Vecinita',
  },
  appSubtitle: {
    en: 'Environmental & Community Information Assistant',
    es: 'Asistente de Información Ambiental y Comunitaria',
  },
  sendMessage: {
    en: 'Send message',
    es: 'Enviar mensaje',
  },
  typePlaceholder: {
    en: 'Type your question...',
    es: 'Escribe tu pregunta...',
  },
  sources: {
    en: 'Sources',
    es: 'Fuentes',
  },
  darkMode: {
    en: 'Dark mode',
    es: 'Modo oscuro',
  },
  lightMode: {
    en: 'Light mode',
    es: 'Modo claro',
  },
  language: {
    en: 'Language',
    es: 'Idioma',
  },
  english: {
    en: 'English',
    es: 'Inglés',
  },
  spanish: {
    en: 'Spanish',
    es: 'Español',
  },
  welcomeMessage: {
    en: 'Hello! I\'m Vecinita, your environmental and community information assistant. I can help you find information about environmental and community topics. Ask me anything!',
    es: '¡Hola! Soy Vecinita, tu asistente de información ambiental y comunitaria. Puedo ayudarte a encontrar información sobre temas ambientales y comunitarios. ¡Pregúntame lo que quieras!',
  },
  newChat: {
    en: 'New chat',
    es: 'Nuevo chat',
  },
  settings: {
    en: 'Settings',
    es: 'Configuración',
  },
  accessibility: {
    en: 'Accessibility',
    es: 'Accesibilidad',
  },
  fontSize: {
    en: 'Font size',
    es: 'Tamaño de fuente',
  },
  contrast: {
    en: 'High contrast',
    es: 'Alto contraste',
  },
  reduceMotion: {
    en: 'Reduce motion',
    es: 'Reducir movimiento',
  },
  close: {
    en: 'Close',
    es: 'Cerrar',
  },
  small: {
    en: 'Small',
    es: 'Pequeño',
  },
  medium: {
    en: 'Medium',
    es: 'Mediano',
  },
  large: {
    en: 'Large',
    es: 'Grande',
  },
  extraLarge: {
    en: 'Extra Large',
    es: 'Extra Grande',
  },
  fontSizeDescription: {
    en: 'Adjust the size of text throughout the application.',
    es: 'Ajusta el tamaño del texto en toda la aplicación.',
  },
  highContrastMode: {
    en: 'High contrast mode',
    es: 'Modo de alto contraste',
  },
  highContrastDescription: {
    en: 'Increase color contrast for better visibility.',
    es: 'Aumenta el contraste de color para mejor visibilidad.',
  },
  reduceMotionMode: {
    en: 'Reduce motion',
    es: 'Reducir movimiento',
  },
  reduceMotionDescription: {
    en: 'Minimize animations and transitions.',
    es: 'Minimiza animaciones y transiciones.',
  },
  keyboardShortcuts: {
    en: 'Keyboard Shortcuts',
    es: 'Atajos de Teclado',
  },
  newLine: {
    en: 'New line',
    es: 'Nueva línea',
  },
  closePanel: {
    en: 'Close panel',
    es: 'Cerrar panel',
  },
  thinkingMessages: {
    en: 'Searching knowledge base...|Analyzing your question...|Finding relevant sources...|Preparing response...',
    es: 'Buscando en la base de conocimientos...|Analizando tu pregunta...|Encontrando fuentes relevantes...|Preparando respuesta...',
  },
  llmModel: {
    en: 'LLM Model',
    es: 'Modelo LLM',
  },
  llmModelDescription: {
    en: 'Select the language model for generating responses.',
    es: 'Selecciona el modelo de lenguaje para generar respuestas.',
  },
  embeddingService: {
    en: 'Embedding Service',
    es: 'Servicio de Embeddings',
  },
  embeddingServiceDescription: {
    en: 'Select the embedding service for vector search.',
    es: 'Selecciona el servicio de embeddings para búsqueda vectorial.',
  },
  llmProvider: {
    en: 'LLM Provider',
    es: 'Proveedor LLM',
  },
  llmProviderDescription: {
    en: 'Select the provider for language models.',
    es: 'Selecciona el proveedor de modelos de lenguaje.',
  },
  embeddingProvider: {
    en: 'Embedding Provider',
    es: 'Proveedor de Embeddings',
  },
  embeddingProviderDescription: {
    en: 'Select the provider for embedding models.',
    es: 'Selecciona el proveedor de modelos de embeddings.',
  },
  backendSettings: {
    en: 'Backend Settings',
    es: 'Configuración del Backend',
  },
  documentDetails: {
    en: 'Document Details',
    es: 'Detalles del Documento',
  },
  metadata: {
    en: 'Metadata',
    es: 'Metadatos',
  },
  createdAt: {
    en: 'Created At',
    es: 'Fecha de Creación',
  },
  documentId: {
    en: 'Document ID',
    es: 'ID del Documento',
  },
  openSource: {
    en: 'Open Source',
    es: 'Abrir Fuente',
  },
  dyslexicFont: {
    en: 'Dyslexic Font',
    es: 'Fuente para Dislexia',
  },
  dyslexicFontMode: {
    en: 'Dyslexic-friendly font',
    es: 'Fuente amigable para dislexia',
  },
  dyslexicFontDescription: {
    en: 'Use a font designed to improve readability for people with dyslexia.',
    es: 'Usa una fuente diseñada para mejorar la legibilidad para personas con dislexia.',
  },
  screenReader: {
    en: 'Screen Reader',
    es: 'Lector de Pantalla',
  },
  screenReaderMode: {
    en: 'Text-to-speech mode',
    es: 'Modo de texto a voz',
  },
  screenReaderDescription: {
    en: 'Enable text-to-speech for messages and UI elements.',
    es: 'Activa texto a voz para mensajes y elementos de la interfaz.',
  },
  highlighterMode: {
    en: 'Highlighter Mode',
    es: 'Modo Resaltador',
  },
  highlighterModeDescription: {
    en: 'Highlight text on hover to improve reading focus.',
    es: 'Resalta el texto al pasar el cursor para mejorar el enfoque de lectura.',
  },
  'assistant.thinking': {
    en: 'Assistant is thinking...',
    es: 'El asistente está pensando...',
  },
  'error.title': {
    en: 'Error',
    es: 'Error',
  },
  'error.retry': {
    en: 'Retry',
    es: 'Reintentar',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    // Load from localStorage, default to Spanish
    const saved = localStorage.getItem('vecinita-language');
    return (saved as Language) || 'es';
  });

  // Save to localStorage when language changes
  React.useEffect(() => {
    localStorage.setItem('vecinita-language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}