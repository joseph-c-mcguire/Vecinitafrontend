import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase, ChatSession } from '@/lib/supabase';

interface ChatHistoryProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChatHistory({
  currentSessionId,
  onSelectSession,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
}: ChatHistoryProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSessions();
    } else {
      setSessions([]);
    }
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // TODO: Replace with actual Supabase query
      // See /BACKEND_IMPLEMENTATION.md Section 8.3 for implementation details
      //
      // const { data, error } = await supabase
      //   .from('chat_sessions')
      //   .select('*')
      //   .eq('user_id', user.id)
      //   .order('updated_at', { ascending: false })
      //   .limit(20);
      //
      // if (error) throw error;
      // setSessions(data || []);

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockSessions: ChatSession[] = [
        {
          id: '1',
          user_id: user.id,
          title: language === 'es' ? 'Consulta sobre reciclaje' : 'Recycling inquiry',
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: '2',
          user_id: user.id,
          title: language === 'es' ? 'Información sobre compostaje' : 'Composting information',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '3',
          user_id: user.id,
          title: language === 'es' ? 'Energía solar en la comunidad' : 'Solar energy in community',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ];
      setSessions(mockSessions);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(language === 'es' ? '¿Eliminar esta conversación?' : 'Delete this conversation?')) {
      return;
    }

    try {
      // TODO: Replace with actual Supabase delete
      // See /BACKEND_IMPLEMENTATION.md Section 8.3 for implementation details
      //
      // const { error } = await supabase
      //   .from('chat_sessions')
      //   .delete()
      //   .eq('id', sessionId);
      //
      // if (error) throw error;

      // Mock deletion
      setSessions(sessions.filter(s => s.id !== sessionId));
      
      // If deleted current session, start new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return language === 'es' 
        ? `Hace ${diffMins} min`
        : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return language === 'es'
        ? `Hace ${diffHours} h`
        : `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return language === 'es'
        ? `Hace ${diffDays} d`
        : `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-30 ${
          isCollapsed ? 'w-0' : 'w-64'
        } overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <button
              onClick={onNewChat}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">
                {language === 'es' ? 'Nueva Conversación' : 'New Chat'}
              </span>
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {language === 'es' 
                    ? 'No hay conversaciones aún'
                    : 'No conversations yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${
                      session.id === currentSessionId
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(session.updated_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity shrink-0"
                        aria-label={language === 'es' ? 'Eliminar' : 'Delete'}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" aria-hidden="true" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className={`fixed top-1/2 -translate-y-1/2 bg-card border border-border rounded-r-lg p-2 hover:bg-accent transition-all duration-300 z-40 ${
          isCollapsed ? 'left-0' : 'left-64'
        }`}
        aria-label={isCollapsed 
          ? (language === 'es' ? 'Mostrar historial' : 'Show history')
          : (language === 'es' ? 'Ocultar historial' : 'Hide history')}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-foreground" aria-hidden="true" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-foreground" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
