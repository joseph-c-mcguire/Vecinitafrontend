import React, { useState, useRef, useEffect } from 'react';
import { Send, Home, MessageSquare, Settings } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ChatMessage, Message } from './components/ChatMessage';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSelector } from './components/LanguageSelector';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { Source } from './components/SourceCard';

function ChatInterface() {
  const { t, language } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add or update welcome message when language changes
    if (messages.length === 0) {
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: t('welcomeMessage'),
          timestamp: new Date(),
        },
      ]);
    } else {
      // Update the welcome message if it's the first message
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === '0') {
          return [
            {
              ...prev[0],
              content: t('welcomeMessage'),
            },
            ...prev.slice(1),
          ];
        }
        return prev;
      });
    }
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Mock RAG responses with sources
  const getMockResponse = (userMessage: string): { content: string; sources: Source[] } => {
    const isSpanish = language === 'es';
    
    // Simple keyword detection for relevant responses
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('water') || lowerMessage.includes('agua') || lowerMessage.includes('contamin')) {
      return {
        content: isSpanish
          ? 'La calidad del agua es un tema importante para la salud comunitaria. Según estudios recientes, la contaminación del agua puede provenir de varias fuentes, incluyendo descargas industriales, escorrentía agrícola y sistemas de alcantarillado obsoletos. Es importante monitorear regularmente la calidad del agua en tu vecindario y reportar cualquier preocupación a las autoridades locales.'
          : 'Water quality is an important topic for community health. According to recent studies, water contamination can come from various sources including industrial discharge, agricultural runoff, and outdated sewage systems. It\'s important to regularly monitor water quality in your neighborhood and report any concerns to local authorities.',
        sources: [
          {
            title: isSpanish ? 'Estándares de Calidad del Agua - EPA' : 'Water Quality Standards - EPA',
            url: 'https://www.epa.gov/wqs-tech',
            snippet: isSpanish
              ? 'Información sobre los estándares de calidad del agua y regulaciones.'
              : 'Information about water quality standards and regulations.',
          },
          {
            title: isSpanish ? 'Monitoreo de Calidad del Agua Comunitaria' : 'Community Water Quality Monitoring',
            url: 'https://www.waterqualitydata.us/',
            snippet: isSpanish
              ? 'Datos de monitoreo de calidad del agua de todo el país.'
              : 'Water quality monitoring data from across the country.',
          },
          {
            title: isSpanish ? 'Guía de Agua Potable Segura' : 'Safe Drinking Water Guide',
            url: 'https://www.cdc.gov/healthywater/',
            snippet: isSpanish
              ? 'Recursos para garantizar agua potable segura en comunidades.'
              : 'Resources for ensuring safe drinking water in communities.',
          },
        ],
      };
    }
    
    if (lowerMessage.includes('air') || lowerMessage.includes('aire') || lowerMessage.includes('pollution') || lowerMessage.includes('contaminación')) {
      return {
        content: isSpanish
          ? 'La calidad del aire afecta directamente nuestra salud respiratoria y bienestar general. Los principales contaminantes incluyen partículas finas (PM2.5), ozono, dióxido de nitrógeno y dióxido de azufre. Puedes verificar la calidad del aire local usando el Índice de Calidad del Aire (AQI) y tomar precauciones durante días de alta contaminación.'
          : 'Air quality directly affects our respiratory health and overall wellbeing. Major pollutants include fine particulate matter (PM2.5), ozone, nitrogen dioxide, and sulfur dioxide. You can check local air quality using the Air Quality Index (AQI) and take precautions during high pollution days.',
        sources: [
          {
            title: isSpanish ? 'Índice de Calidad del Aire - AirNow' : 'Air Quality Index - AirNow',
            url: 'https://www.airnow.gov/',
            snippet: isSpanish
              ? 'Información en tiempo real sobre la calidad del aire en tu área.'
              : 'Real-time air quality information for your area.',
          },
          {
            title: isSpanish ? 'Efectos de la Contaminación del Aire en la Salud' : 'Health Effects of Air Pollution',
            url: 'https://www.who.int/health-topics/air-pollution',
            snippet: isSpanish
              ? 'Información de la OMS sobre impactos en la salud.'
              : 'WHO information on health impacts.',
          },
        ],
      };
    }
    
    if (lowerMessage.includes('climate') || lowerMessage.includes('clima') || lowerMessage.includes('change') || lowerMessage.includes('cambio')) {
      return {
        content: isSpanish
          ? 'El cambio climático está afectando a las comunidades de varias maneras, incluyendo eventos climáticos extremos más frecuentes, cambios en los patrones de temperatura y precipitación, y amenazas a la infraestructura local. Las comunidades pueden tomar medidas para la adaptación climática y la resiliencia mediante planificación urbana sostenible, infraestructura verde y preparación para emergencias.'
          : 'Climate change is affecting communities in various ways, including more frequent extreme weather events, shifts in temperature and precipitation patterns, and threats to local infrastructure. Communities can take steps toward climate adaptation and resilience through sustainable urban planning, green infrastructure, and emergency preparedness.',
        sources: [
          {
            title: isSpanish ? 'Adaptación Climática - NOAA' : 'Climate Adaptation - NOAA',
            url: 'https://www.noaa.gov/education/resource-collections/climate',
            snippet: isSpanish
              ? 'Recursos sobre adaptación y resiliencia climática.'
              : 'Resources on climate adaptation and resilience.',
          },
          {
            title: isSpanish ? 'Guía de Acción Climática Comunitaria' : 'Community Climate Action Guide',
            url: 'https://www.c2es.org/',
            snippet: isSpanish
              ? 'Estrategias prácticas para la acción climática local.'
              : 'Practical strategies for local climate action.',
          },
        ],
      };
    }
    
    // Default response
    return {
      content: isSpanish
        ? 'Gracias por tu pregunta. Como asistente de información ambiental y comunitaria, puedo ayudarte con temas relacionados con calidad del agua, calidad del aire, cambio climático, justicia ambiental y recursos comunitarios. ¿Podrías darme más detalles sobre lo que te gustaría saber?'
        : 'Thank you for your question. As an environmental and community information assistant, I can help you with topics related to water quality, air quality, climate change, environmental justice, and community resources. Could you provide more details about what you\'d like to know?',
      sources: [
        {
          title: isSpanish ? 'Centro de Recursos Ambientales' : 'Environmental Resources Center',
          url: 'https://www.epa.gov/',
          snippet: isSpanish
            ? 'Recursos generales sobre temas ambientales y comunitarios.'
            : 'General resources on environmental and community topics.',
        },
      ],
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const response = getMockResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content: t('welcomeMessage'),
        timestamp: new Date(),
      },
    ]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle ESC key to close accessibility panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccessibilityOpen) {
        setIsAccessibilityOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAccessibilityOpen]);

  // Cycle through thinking messages
  useEffect(() => {
    if (!isLoading) {
      setThinkingMessageIndex(0);
      return;
    }

    const thinkingMessages = t('thinkingMessages').split('|');
    const interval = setInterval(() => {
      setThinkingMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 800);

    return () => clearInterval(interval);
  }, [isLoading, language]);

  const getThinkingMessage = () => {
    const thinkingMessages = t('thinkingMessages').split('|');
    return thinkingMessages[thinkingMessageIndex] || thinkingMessages[0];
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Home className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl text-foreground truncate">{t('appTitle')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {t('appSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handleNewChat}
              className="p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
              aria-label={t('newChat')}
              title={t('newChat')}
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
              <span className="hidden md:inline text-foreground">{t('newChat')}</span>
            </button>
            <button
              onClick={() => setIsAccessibilityOpen(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={t('accessibility')}
              title={t('accessibility')}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
            </button>
            <LanguageSelector />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto" role="main">
        <div className="container mx-auto max-w-4xl px-0 sm:px-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/30" role="status" aria-live="polite">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base text-muted-foreground break-words">{getThinkingMessage()}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto max-w-4xl p-2 sm:p-4">
          <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
            <label htmlFor="message-input" className="sr-only">
              {t('typePlaceholder')}
            </label>
            <textarea
              ref={inputRef}
              id="message-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('typePlaceholder')}
              className="flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base"
              rows={1}
              disabled={isLoading}
              aria-label={t('typePlaceholder')}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              aria-label={t('sendMessage')}
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </button>
          </form>
          <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1.5 sm:mt-2 px-2">
            {language === 'es'
              ? 'Este chatbot proporcionará información basada en una base de datos vectorial de Supabase cuando esté conectado.'
              : 'This chatbot will provide information based on a Supabase vector database when connected.'}
          </p>
        </div>
      </footer>

      {/* Accessibility Panel */}
      <AccessibilityPanel
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <ChatInterface />
      </AccessibilityProvider>
    </LanguageProvider>
  );
}