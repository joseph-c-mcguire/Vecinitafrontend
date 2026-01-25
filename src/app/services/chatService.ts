import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];
export type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];

export interface CreateMessageData {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  llmModel?: string;
}

export interface CreateSessionData {
  title?: string;
}

export class ChatService {
  /**
   * Create a new chat session
   */
  static async createSession(data: CreateSessionData = {}): Promise<ChatSession> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user?.id || null,
        title: data.title || 'New Chat',
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  }

  /**
   * Get all chat sessions for the current user
   */
  static async getSessions(): Promise<ChatSession[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user?.id || '')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific session by ID
   */
  static async getSession(sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  /**
   * Update a chat session
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<Pick<ChatSession, 'title'>>
  ): Promise<ChatSession> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a chat session and all its messages
   */
  static async deleteSession(sessionId: string): Promise<void> {
    // Delete messages first
    await supabase.from('chat_history').delete().eq('session_id', sessionId);

    // Then delete session
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Add a message to a chat session
   */
  static async addMessage(data: CreateMessageData): Promise<ChatMessage> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: message, error } = await supabase
      .from('chat_history')
      .insert({
        user_id: user?.id || null,
        session_id: data.sessionId,
        role: data.role,
        content: data.content,
        sources: data.sources || null,
        llm_model: data.llmModel || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update session's updated_at timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', data.sessionId);

    return message;
  }

  /**
   * Get all messages for a session
   */
  static async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Delete a specific message
   */
  static async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  }

  /**
   * Search messages across all sessions
   */
  static async searchMessages(query: string): Promise<ChatMessage[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user?.id || '')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }
}
