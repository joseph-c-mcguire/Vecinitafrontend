import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Minimize2, Settings as SettingsIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { ChatMessage, Message } from './ChatMessage';
import { Feedback } from './MessageFeedback';
import { Source } from './SourceCard';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';
import { AccessibilityPanel } from './AccessibilityPanel';

interface ChatWidgetProps {
  /**
   * Position of the widget on the screen
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  
  /**
   * Primary color for the widget (overrides default turquoise)
   */
  primaryColor?: string;
  
  /**
   * Initial open state
   * @default false
   */
  defaultOpen?: boolean;
  
  /**
   * Custom welcome message
   */
  customWelcomeMessage?: string;
  
  /**
   * Custom widget title
   */
  title?: string;
  
  /**
   * Theme preference ('light' | 'dark' | 'auto')
   * @default 'auto'
   */
  themeMode?: 'light' | 'dark' | 'auto';
  
  /**
   * z-index for the widget
   * @default 1000
   */
  zIndex?: number;
}

export function ChatWidget({
  position = 'bottom-right',
  primaryColor,
  defaultOpen = false,
  customWelcomeMessage,
  title,
  themeMode = 'auto',
  zIndex = 1000,
}: ChatWidgetProps) {
  const { t, language } = useLanguage();
  const { settings: accessibilitySettings } = useAccessibility();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (themeMode === 'auto') {
      const saved = localStorage.getItem('vecinita-widget-theme');
      return (saved as 'light' | 'dark') || 'light';
    }
    return themeMode;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save theme to localStorage
  useEffect(() => {
    if (themeMode === 'auto') {
      localStorage.setItem('vecinita-widget-theme', theme);
    }
  }, [theme, themeMode]);

  // Initialize welcome message
  useEffect(() => {
    const welcomeMsg = customWelcomeMessage || t('welcomeMessage');
    if (messages.length === 0) {
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: welcomeMsg,
          timestamp: new Date(),
        },
      ]);
    } else {
      // Update welcome message when language changes
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === '0') {
          return [
            {
              ...prev[0],
              content: welcomeMsg,
            },
            ...prev.slice(1),
          ];
        }
        return prev;
      });
    }
  }, [language, customWelcomeMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getThinkingMessage = () => {
    const thinkingMessages = t('thinkingMessages').split('|');
    return thinkingMessages[thinkingMessageIndex] || thinkingMessages[0];
  };

  // Mock RAG responses with sources
  const getMockResponse = (userMessage: string): { content: string; sources: Source[] } => {
    const isSpanish = language === 'es';
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('water') || lowerMessage.includes('agua') || lowerMessage.includes('contamin')) {
      return {
        content: isSpanish
          ? 'La calidad del agua es un tema importante para la salud comunitaria. Según estudios recientes, la contaminación del agua puede provenir de varias fuentes, incluyendo descargas industriales, escorrentía agrícola y sistemas de alcantarillado obsoletos.'
          : 'Water quality is an important topic for community health. According to recent studies, water contamination can come from various sources including industrial discharge, agricultural runoff, and outdated sewage systems.',
        sources: [
          {
            title: isSpanish ? 'Estándares de Calidad del Agua - EPA' : 'Water Quality Standards - EPA',
            url: 'https://www.epa.gov/wqs-tech',
            snippet: isSpanish
              ? 'Información sobre los estándares de calidad del agua y regulaciones.'
              : 'Information about water quality standards and regulations.',
          },
        ],
      };
    }
    
    return {
      content: isSpanish
        ? 'Gracias por tu pregunta. Puedo ayudarte con temas relacionados con calidad del agua, calidad del aire, cambio climático y recursos comunitarios. ¿Podrías darme más detalles?'
        : 'Thank you for your question. I can help you with topics related to water quality, air quality, climate change, and community resources. Could you provide more details?',
      sources: [],
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

    setTimeout(() => {
      const response = getMockResponse(userMessageContent);
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

  const handleFeedbackSubmit = (feedback: Feedback) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === feedback.messageId ? { ...msg, feedback } : msg
      )
    );

    const storedFeedback = localStorage.getItem('vecinita_widget_feedback');
    const feedbackData = storedFeedback ? JSON.parse(storedFeedback) : {};
    feedbackData[feedback.messageId] = {
      rating: feedback.rating,
      comment: feedback.comment,
      timestamp: feedback.timestamp.toISOString(),
    };
    localStorage.setItem('vecinita_widget_feedback', JSON.stringify(feedbackData));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content: customWelcomeMessage || t('welcomeMessage'),
        timestamp: new Date(),
      },
    ]);
    setInput('');
  };

  // Position styles
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  const widgetTitle = title || t('appTitle');

  // Apply custom primary color if provided
  useEffect(() => {
    if (primaryColor && isOpen) {
      document.documentElement.style.setProperty('--widget-primary', primaryColor);
    }
  }, [primaryColor, isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses[position]} w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-4 focus:ring-primary/50`}
        style={{ 
          backgroundColor: primaryColor || '#4DB8B8',
          zIndex,
        }}
        aria-label={t('newChat')}
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed ${positionClasses[position]} flex flex-col shadow-2xl rounded-lg overflow-hidden border border-border transition-all ${
          isMinimized ? 'h-14' : 'h-[600px]'
        } w-[400px] max-w-[calc(100vw-2rem)]`}
        style={{ zIndex }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b border-border"
          style={{ 
            backgroundColor: primaryColor || '#4DB8B8',
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageSquare className="w-5 h-5 text-white shrink-0" />
            <h2 className="text-white font-medium text-sm truncate">{widgetTitle}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsAccessibilityOpen(true)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={t('accessibility')}
              title={t('accessibility')}
            >
              <SettingsIcon className="w-4 h-4 text-white" />
            </button>
            <LanguageSelector variant="compact" />
            <ThemeToggle theme={theme} setTheme={setTheme} variant="compact" />
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Minimize2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              aria-label={t('close')}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {!isMinimized && (
          <>
            {/* Messages */}
            <div className={`flex-1 overflow-y-auto bg-background ${theme === 'dark' ? 'dark' : ''}`}>
              <div className="max-w-full">
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message} 
                    onFeedbackSubmit={handleFeedbackSubmit}
                  />
                ))}
                {isLoading && (
                  <div className="flex gap-2 p-3 bg-muted/30" role="status" aria-live="polite">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground break-words">{getThinkingMessage()}</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card p-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('typePlaceholder')}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  rows={1}
                  disabled={isLoading}
                  aria-label={t('typePlaceholder')}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-3 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  style={{ 
                    backgroundColor: primaryColor || '#4DB8B8',
                    color: 'white',
                  }}
                  aria-label={t('sendMessage')}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Accessibility Panel */}
      {isAccessibilityOpen && (
        <div style={{ zIndex: zIndex + 10 }}>
          <AccessibilityPanel isOpen={isAccessibilityOpen} onClose={() => setIsAccessibilityOpen(false)} />
        </div>
      )}
    </>
  );
}
