import React, { useState, useRef, useEffect } from 'react';
import { Send, Home, MessageSquare, Settings, Shield, Sliders, User, Menu } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { BackendSettingsProvider } from './context/BackendSettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatMessage, Message } from './components/ChatMessage';
import { Feedback } from './components/MessageFeedback';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSelector } from './components/LanguageSelector';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { BackendSettingsPanel } from './components/BackendSettingsPanel';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { ChatHistorySidebar, ChatHistorySidebarRef } from './components/ChatHistorySidebar';
import { Source } from './components/SourceCard';
import { SkipToContent } from './components/SkipToContent';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

function ChatInterface() {
  const { t, language } = useLanguage();
  const { user, isAnonymous } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isBackendSettingsOpen, setIsBackendSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(generateSessionId());
  const [sessionCreatedInDb, setSessionCreatedInDb] = useState(false);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<ChatHistorySidebarRef>(null);

  // Handle ESC key to close accessibility panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAccessibilityOpen) {
          setIsAccessibilityOpen(false);
        } else if (isBackendSettingsOpen) {
          setIsBackendSettingsOpen(false);
        } else if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
        } else if (isPrivacyPolicyOpen) {
          setIsPrivacyPolicyOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAccessibilityOpen, isBackendSettingsOpen, isAuthModalOpen, isPrivacyPolicyOpen]);

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

  // Helper: Create chat session in database
  const createChatSession = async (firstMessage: string): Promise<boolean> => {
    if (isAnonymous || !user) return false;

    try {
      const title = firstMessage.substring(0, 60) + (firstMessage.length > 60 ? '...' : '');
      
      const { error } = await supabase
        .from('chat_sessions')
        .insert({
          id: currentSessionId,
          user_id: user.id,
          title: title,
        });

      if (error) {
        console.error('Error creating session:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error creating chat session:', err);
      return false;
    }
  };

  // Helper: Save message to database
  const saveMessage = async (message: Message): Promise<void> => {
    if (isAnonymous || !user) return;

    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({
          session_id: currentSessionId,
          role: message.role,
          content: message.content,
          sources: message.sources || null,
        });

      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
  };

  // Helper: Update session timestamp
  const updateSessionTimestamp = async (): Promise<void> => {
    if (isAnonymous || !user) return;

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);

      if (error) {
        console.error('Error updating session timestamp:', error);
      }
    } catch (err) {
      console.error('Error updating session timestamp:', err);
    }
  };

  // Mock RAG responses with sources
  const getMockResponse = (userMessage: string): { content: string; sources: Source[] } => {
    // TODO: Replace with actual RAG implementation
    // See /BACKEND_IMPLEMENTATION.md Section 5 for complete RAG implementation
    //
    // const getRagResponse = async (userMessage: string) => {
    //   // 1. Generate embedding for user query
    //   const queryEmbedding = await generateQueryEmbedding(userMessage);
    //   
    //   // 2. Search vector database for relevant chunks
    //   const { data: matches } = await supabase.rpc('match_documents', {
    //     query_embedding: queryEmbedding,
    //     match_threshold: 0.7,
    //     match_count: 5
    //   });
    //   
    //   // 3. Build context from matched chunks
    //   const context = matches.map(m => m.content).join('\n\n');
    //   
    //   // 4. Call LLM with context and query
    //   const llmResponse = await callLLM({
    //     model: settings.llmModel,
    //     provider: settings.llmProvider,
    //     context,
    //     query: userMessage,
    //     language: language
    //   });
    //   
    //   // 5. Build sources array for citations
    //   // ...
    //   
    //   return { content: llmResponse, sources };
    // };
    
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

    const userMessageContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create session in database if this is the first user message
    if (!isAnonymous && !sessionCreatedInDb) {
      const created = await createChatSession(userMessageContent);
      if (created) {
        setSessionCreatedInDb(true);
        // Refresh sidebar to show new session
        sidebarRef.current?.refreshSessions();
      }
    }

    // Save user message to database
    await saveMessage(userMessage);

    // Simulate API delay
    setTimeout(async () => {
      const response = getMockResponse(userMessageContent);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Save assistant message to database
      await saveMessage(assistantMessage);
      
      // Update session timestamp
      await updateSessionTimestamp();
      
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
    setCurrentSessionId(generateSessionId());
    setSessionCreatedInDb(false);
  };

  const handleFeedbackSubmit = async (feedback: Feedback) => {
    // Update message with feedback in local state
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === feedback.messageId ? { ...msg, feedback } : msg
      )
    );

    // Save feedback to database (if user is authenticated)
    if (!isAnonymous && user) {
      try {
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
        }
      } catch (err) {
        console.error('Error saving feedback:', err);
      }
    } else {
      // For anonymous users, save to localStorage
      const storedFeedback = localStorage.getItem('message_feedback');
      const feedbackData = storedFeedback ? JSON.parse(storedFeedback) : {};
      feedbackData[feedback.messageId] = {
        rating: feedback.rating,
        comment: feedback.comment,
        timestamp: feedback.timestamp.toISOString(),
      };
      localStorage.setItem('message_feedback', JSON.stringify(feedbackData));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Alt + N: New conversation
      if (e.altKey && e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleNewChat();
        return;
      }

      // Alt + H: Toggle history sidebar
      if (e.altKey && e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        sidebarRef.current?.toggleSidebar();
        return;
      }

      // Alt + S: Open settings
      if (e.altKey && e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        setIsBackendSettingsOpen(true);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [t]);

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

  // Show admin dashboard if in admin view
  if (isAdminView) {
    return <AdminDashboard onClose={() => setIsAdminView(false)} />;
  }

  const handleSessionSelect = async (sessionId: string) => {
    // TODO: Load session messages from database
    // See /BACKEND_IMPLEMENTATION.md Section 8.3
    
    setCurrentSessionId(sessionId);
    
    // TODO: Fetch messages for this session
    // const { data, error } = await supabase
    //   .from('chat_history')
    //   .select('*')
    //   .eq('session_id', sessionId)
    //   .order('created_at', { ascending: true });
    //
    // if (!error && data) {
    //   const loadedMessages = data.map(msg => ({
    //     id: msg.id,
    //     role: msg.role,
    //     content: msg.content,
    //     sources: msg.sources,
    //     timestamp: new Date(msg.created_at),
    //   }));
    //   setMessages(loadedMessages);
    // }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Enlace de Saltar al Contenido - siempre primero para accesibilidad */}
      <SkipToContent />
      
      {/* Chat History Sidebar - Always visible */}
      <ChatHistorySidebar
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        onAuthClick={() => setIsAuthModalOpen(true)}
        ref={sidebarRef}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile menu button */}
              <button
                onClick={() => sidebarRef.current?.toggleMobile()}
                className="p-2 rounded-lg hover:bg-accent transition-colors md:hidden"
                aria-label={language === 'es' ? 'Abrir menú' : 'Open menu'}
                data-history-toggle
              >
                <Menu className="w-5 h-5 text-foreground" aria-hidden="true" />
              </button>
              
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
              {/* Auth Button */}
              {user ? (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                  aria-label={language === 'es' ? 'Cerrar sesión' : 'Sign out'}
                  title={language === 'es' ? 'Cerrar sesión' : 'Sign out'}
                >
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
                  <span className="hidden lg:inline text-foreground text-sm">
                    {language === 'es' ? 'Salir' : 'Sign out'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                  aria-label={language === 'es' ? 'Iniciar sesión' : 'Sign in'}
                  title={language === 'es' ? 'Iniciar sesión' : 'Sign in'}
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
                  <span className="hidden lg:inline text-foreground text-sm">
                    {language === 'es' ? 'Ingresar' : 'Sign in'}
                  </span>
                </button>
              )}
              <button
                onClick={handleNewChat}
                className="p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                aria-label={t('newChat')}
                title={t('newChat')}
                data-new-chat
              >
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
                <span className="hidden md:inline text-foreground">{t('newChat')}</span>
              </button>
              <button
                onClick={() => setIsAdminView(true)}
                className="hidden md:flex p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label={t('admin')}
                title={t('admin')}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
              </button>
              <button
                onClick={() => setIsBackendSettingsOpen(true)}
                className="hidden md:flex p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label={t('backendSettings')}
                title={t('backendSettings')}
                data-settings
              >
                <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" aria-hidden="true" />
              </button>
              <button
                onClick={() => setIsAccessibilityOpen(true)}
                className="hidden md:flex p-2 rounded-lg hover:bg-accent transition-colors"
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
        <main id="main-content" className="flex-1 overflow-y-auto" role="main" tabIndex={-1}>
          <div className="container mx-auto max-w-4xl px-0 sm:px-4">
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                onFeedbackSubmit={handleFeedbackSubmit}
              />
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
            <div className="text-center mt-2">
              <button
                onClick={() => setIsPrivacyPolicyOpen(true)}
                className="text-[10px] sm:text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Accessibility Panel */}
      <AccessibilityPanel
        isOpen={isAccessibilityOpen}
        onClose={() => setIsAccessibilityOpen(false)}
      />

      {/* Backend Settings Panel */}
      <BackendSettingsPanel
        isOpen={isBackendSettingsOpen}
        onClose={() => setIsBackendSettingsOpen(false)}
      />

      {/* Ayuda de Atajos de Teclado */}
      <KeyboardShortcutsHelp />

      {/* Política de Privacidad */}
      <PrivacyPolicy
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <BackendSettingsProvider>
          <AuthProvider>
            <ChatInterface />
          </AuthProvider>
        </BackendSettingsProvider>
      </AccessibilityProvider>
    </LanguageProvider>
  );
}

function generateSessionId(): string {
  return Math.random().toString(36).substr(2, 9);
}