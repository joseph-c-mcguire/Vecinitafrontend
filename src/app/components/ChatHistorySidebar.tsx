import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight, LogIn, LogOut, User as UserIcon, Menu, X, GripVertical } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/lib/supabase';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistorySidebarProps {
  currentSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onAuthClick: () => void;
}

export interface ChatHistorySidebarRef {
  refreshSessions: () => Promise<void>;
  toggleMobile: () => void;
  toggleSidebar: () => void;
}

export const ChatHistorySidebar = forwardRef<ChatHistorySidebarRef, ChatHistorySidebarProps>((({
  currentSessionId,
  onSessionSelect,
  onNewChat,
  onAuthClick,
}, ref) => {
  const { t, language } = useLanguage();
  const { user, isAnonymous, signOut } = useAuth();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close mobile sidebar on resize to desktop
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load sidebar width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      const width = parseInt(savedWidth);
      if (width >= 200 && width <= 600) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // Disable resize on mobile
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      // Min width: 200px, Max width: 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
        localStorage.setItem('sidebarWidth', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Load chat sessions when user changes
  useEffect(() => {
    if (!isAnonymous) {
      loadSessions();
    } else {
      setSessions([]);
    }
  }, [user, isAnonymous]);

  const loadSessions = async () => {
    if (isAnonymous) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Error loading chat sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refresh function and mobile toggle to parent
  useImperativeHandle(ref, () => ({
    refreshSessions: loadSessions,
    toggleMobile: () => setIsMobileOpen(prev => !prev),
    toggleSidebar: () => setIsCollapsed(prev => !prev)
  }));

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(language === 'es' 
      ? '¿Eliminar esta conversación?' 
      : 'Delete this conversation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        return;
      }

      // Remove from local state
      setSessions(sessions.filter(s => s.id !== sessionId));

      // If we deleted the current session, start a new one
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSessions([]);
    onNewChat();
  };

  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId);
    // Close mobile sidebar after selection
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  const handleNewChatClick = () => {
    onNewChat();
    // Close mobile sidebar after creating new chat
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  if (isCollapsed && !isMobile) {
    return (
      <div className="w-12 h-full bg-card border-r border-border flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label={language === 'es' ? 'Expandir barra lateral' : 'Expand sidebar'}
        >
          <ChevronRight className="w-5 h-5 text-foreground" aria-hidden="true" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label={language === 'es' ? 'Nueva conversación' : 'New chat'}
        >
          <Plus className="w-5 h-5 text-foreground" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          {language === 'es' ? 'Conversaciones' : 'Conversations'}
        </h2>
        <div className="flex items-center gap-1">
          {isMobile && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors md:hidden"
              aria-label={language === 'es' ? 'Cerrar menú' : 'Close menu'}
            >
              <X className="w-4 h-4 text-foreground" aria-hidden="true" />
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              aria-label={language === 'es' ? 'Colapsar barra lateral' : 'Collapse sidebar'}
            >
              <ChevronLeft className="w-4 h-4 text-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNewChatClick}
          className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{language === 'es' ? 'Nueva Conversación' : 'New Chat'}</span>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isAnonymous ? (
          /* Anonymous users: Show current session only */
          <div className="p-2">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">
                  {language === 'es' ? 'Sesión Actual' : 'Current Session'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'es'
                  ? 'Esta sesión no se guardará. Inicie sesión para guardar su historial.'
                  : 'This session will not be saved. Sign in to save your history.'}
              </p>
            </div>
            
            <div className="p-3 bg-accent/50 rounded-lg text-center">
              <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-3 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {language === 'es'
                  ? 'Inicie sesión para acceder a su historial de conversaciones'
                  : 'Sign in to access your conversation history'}
              </p>
              <button
                onClick={onAuthClick}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2 mx-auto"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span>{language === 'es' ? 'Iniciar Sesión' : 'Sign In'}</span>
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {language === 'es' ? 'Cargando...' : 'Loading...'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* Current Session Box - Shows when user has active session not yet in saved list */}
            {currentSessionId && !sessions.find(s => s.id === currentSessionId) && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">
                    {language === 'es' ? 'Chat Nuevo' : 'New Chat'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === 'es'
                    ? 'Envía un mensaje para comenzar'
                    : 'Send a message to begin'}
                </p>
              </div>
            )}
            
            {/* Saved Sessions List */}
            {sessions.length === 0 ? (
              <div className="p-4 text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {language === 'es'
                    ? 'No hay conversaciones guardadas'
                    : 'No saved conversations'}
                </p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg transition-colors ${
                    session.id === currentSessionId
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => handleSessionClick(session.id)}
                    className="w-full px-3 py-2 text-left text-sm text-foreground flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{session.title}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={language === 'es' ? 'Eliminar conversación' : 'Delete conversation'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User Info / Auth Section */}
      <div className="p-3 border-t border-border">
        {isAnonymous ? (
          <button
            onClick={onAuthClick}
            className="w-full px-3 py-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors flex items-center gap-2 text-sm text-foreground"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>{language === 'es' ? 'Iniciar Sesión' : 'Sign In'}</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors flex items-center gap-2 text-sm text-foreground"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{language === 'es' ? 'Cerrar Sesión' : 'Sign Out'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Mobile: Overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-300 md:hidden ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: '280px' }}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  // Desktop: Resizable sidebar
  return (
    <div className="relative h-full bg-card border-r border-border flex flex-col" style={{ width: sidebarWidth }}>
      {sidebarContent}
      
      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 hover:w-4 bg-border/30 hover:bg-primary/30 cursor-ew-resize transition-all group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}));

ChatHistorySidebar.displayName = 'ChatHistorySidebar';