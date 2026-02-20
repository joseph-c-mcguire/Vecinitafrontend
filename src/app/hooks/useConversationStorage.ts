/**
 * Conversation Storage Hook
 *
 * Manages local storage of conversation history with automatic 24-hour expiration.
 * Stores conversations in localStorage with thread-based keys.
 */

import { useEffect, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  timestamp: Date;
  feedback?: {
    rating: 'positive' | 'negative';
    comment?: string;
  };
}

interface StoredConversation {
  messages: Message[];
  expiresAt: number;
  threadId: string;
  createdAt: number;
}

const STORAGE_PREFIX = 'vecinita-thread-';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CONVERSATIONS = 20;         // max stored threads
const MAX_MESSAGES_PER_THREAD = 100;  // cap per thread to avoid quota overflow

/** Safe localStorage wrapper — never throws (private browsing, quota, etc.) */
const safeStorage = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string): boolean => {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
  keys: (): string[] => {
    try {
      return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '').filter(Boolean);
    } catch { return []; }
  },
};

/**
 * Custom hook for managing conversation storage with automatic cleanup.
 */
export function useConversationStorage(threadId: string) {
  const storageKey = `${STORAGE_PREFIX}${threadId}`;

  /**
   * Clear all expired conversations from localStorage.
   */
  const clearExpired = useCallback(() => {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const key of safeStorage.keys()) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const stored = safeStorage.get(key);
        if (stored) {
          try {
            const data = JSON.parse(stored) as StoredConversation;
            if (data.expiresAt < now) keysToRemove.push(key);
          } catch {
            keysToRemove.push(key); // corrupt — remove
          }
        }
      }
    }

    keysToRemove.forEach((k) => safeStorage.remove(k));

    // Enforce MAX_CONVERSATIONS cap: evict oldest if over limit
    const allThreadKeys = safeStorage
      .keys()
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .map((k) => {
        try {
          const d = JSON.parse(safeStorage.get(k) ?? '{}') as StoredConversation;
          return { key: k, createdAt: d.createdAt ?? 0 };
        } catch {
          return { key: k, createdAt: 0 };
        }
      })
      .sort((a, b) => a.createdAt - b.createdAt); // oldest first

    if (allThreadKeys.length > MAX_CONVERSATIONS) {
      allThreadKeys
        .slice(0, allThreadKeys.length - MAX_CONVERSATIONS)
        .forEach(({ key }) => safeStorage.remove(key));
    }
  }, []);

  /**
   * Save messages to localStorage with current timestamp and expiration.
   */
  const saveMessages = useCallback(
    (messages: Message[]) => {
      // Enforce per-thread message cap
      const capped = messages.slice(-MAX_MESSAGES_PER_THREAD);
      const now = Date.now();
      const conversation: StoredConversation = {
        messages: capped,
        threadId,
        createdAt: now,
        expiresAt: now + TTL_MS,
      };

      const ok = safeStorage.set(storageKey, JSON.stringify(conversation));
      if (!ok) {
        // Quota hit — clear expired and retry once
        clearExpired();
        safeStorage.set(storageKey, JSON.stringify(conversation));
      }
    },
    [threadId, storageKey, clearExpired]
  );

  /**
   * Load messages from localStorage for the current thread.
   * Returns null if not found or expired.
   */
  const loadMessages = useCallback((): Message[] | null => {
    const stored = safeStorage.get(storageKey);
    if (!stored) return null;
    try {
      const data = JSON.parse(stored) as StoredConversation;
      if (data.expiresAt < Date.now()) {
        safeStorage.remove(storageKey);
        return null;
      }
      return data.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch {
      return null;
    }
  }, [storageKey]);

  /**
   * Delete the current thread from storage.
   */
  const deleteThread = useCallback(() => {
    safeStorage.remove(storageKey);
  }, [storageKey]);

  /**
   * Get all stored thread IDs (non-expired).
   */
  const getAllThreadIds = useCallback((): string[] => {
    const now = Date.now();
    const threadIds: string[] = [];

    for (const key of safeStorage.keys()) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const stored = safeStorage.get(key);
        if (stored) {
          try {
            const data = JSON.parse(stored) as StoredConversation;
            if (data.expiresAt >= now) threadIds.push(data.threadId);
          } catch { /* skip corrupt */ }
        }
      }
    }
    return threadIds;
  }, []);

  /**
   * Get time until expiration for current thread in milliseconds.
   * Returns null if thread doesn't exist.
   */
  const getTimeRemaining = useCallback((): number | null => {
    const stored = safeStorage.get(storageKey);
    if (!stored) return null;
    try {
      const data = JSON.parse(stored) as StoredConversation;
      const remaining = data.expiresAt - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch {
      return null;
    }
  }, [storageKey]);

  // Run cleanup on mount
  useEffect(() => {
    clearExpired();
  }, [clearExpired]);

  return {
    saveMessages,
    loadMessages,
    deleteThread,
    clearExpired,
    getAllThreadIds,
    getTimeRemaining,
  };
}
