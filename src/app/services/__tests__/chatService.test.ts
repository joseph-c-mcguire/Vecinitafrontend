import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../chatService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new chat session', async () => {
      const mockUser = { id: 'user-123' };
      const mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        title: 'New Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSession,
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const result = await ChatService.createSession({ title: 'New Chat' });

      expect(result).toEqual(mockSession);
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: 'New Chat',
      });
    });

    it('should use default title when not provided', async () => {
      const mockUser = { id: 'user-123' };
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { title: 'New Chat' },
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      await ChatService.createSession();

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: 'New Chat',
      });
    });
  });

  describe('addMessage', () => {
    it('should add a message to a session', async () => {
      const mockUser = { id: 'user-123' };
      const mockMessage = {
        id: 'message-123',
        user_id: 'user-123',
        session_id: 'session-123',
        role: 'user' as const,
        content: 'Hello',
        sources: null,
        llm_model: null,
        created_at: new Date().toISOString(),
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockMessage,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_history') {
          return { insert: mockInsert } as any;
        }
        if (table === 'chat_sessions') {
          return { update: mockUpdate } as any;
        }
        return {} as any;
      });

      const result = await ChatService.addMessage({
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello',
      });

      expect(result).toEqual(mockMessage);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('should retrieve messages for a session', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          session_id: 'session-123',
          role: 'user' as const,
          content: 'Hello',
          created_at: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          session_id: 'session-123',
          role: 'assistant' as const,
          content: 'Hi there!',
          created_at: new Date().toISOString(),
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockMessages,
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await ChatService.getMessages('session-123');

      expect(result).toEqual(mockMessages);
      expect(mockSelect).toHaveBeenCalledWith('*');
    });
  });

  describe('searchMessages', () => {
    it('should search messages by content', async () => {
      const mockUser = { id: 'user-123' };
      const mockResults = [
        {
          id: 'msg-1',
          content: 'test message',
          created_at: new Date().toISOString(),
        },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockResults,
                error: null,
              }),
            }),
          }),
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await ChatService.searchMessages('test');

      expect(result).toEqual(mockResults);
    });
  });
});
