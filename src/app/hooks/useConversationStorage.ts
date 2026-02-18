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

    // Scan all localStorage keys for expired threads
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored) as StoredConversation;
            if (data.expiresAt < now) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          console.error(`Failed to parse stored conversation: ${key}`, error);
          keysToRemove.push(key);
        }
      }
    }

    // Remove expired entries
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log(`Cleared ${keysToRemove.length} expired conversations`);
    }
  }, []);

  /**
   * Save messages to localStorage with current timestamp and expiration.
   */
  const saveMessages = useCallback(
    (messages: Message[]) => {
      const now = Date.now();
      const conversation: StoredConversation = {
        messages,
        threadId,
        createdAt: now,
        expiresAt: now + TTL_MS,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(conversation));
      } catch (error) {
        console.error('Failed to save conversation to localStorage:', error);
        // If quota exceeded, try clearing expired and retry once
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          clearExpired();
          try {
            localStorage.setItem(storageKey, JSON.stringify(conversation));
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError);
          }
        }
      }
    },
    [threadId, storageKey, clearExpired]
  );

  /**
   * Load messages from localStorage for the current thread.
   * Returns null if not found or expired.
   */
  const loadMessages = useCallback((): Message[] | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return null;
      }

      const data = JSON.parse(stored) as StoredConversation;

      // Check if expired
      if (data.expiresAt < Date.now()) {
        localStorage.removeItem(storageKey);
        return null;
      }

      // Restore Date objects from ISO strings
      return data.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error) {
      console.error('Failed to load conversation from localStorage:', error);
      return null;
    }
  }, [storageKey]);

  /**
   * Delete the current thread from storage.
   */
  const deleteThread = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to delete thread from localStorage:', error);
    }
  }, [storageKey]);

  /**
   * Get all stored thread IDs (non-expired).
   */
  const getAllThreadIds = useCallback((): string[] => {
    const now = Date.now();
    const threadIds: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored) as StoredConversation;
            if (data.expiresAt >= now) {
              threadIds.push(data.threadId);
            }
          }
        } catch (error) {
          console.error(`Failed to parse thread: ${key}`, error);
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
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

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
