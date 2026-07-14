/**
 * useChatPersistence — persists chat messages to localStorage per room.
 * Keeps a rolling window of the last 200 messages per room.
 */
import { useCallback } from 'react';

const MAX_MESSAGES = 200;
const KEY_PREFIX = 'cs_chat_';

export const useChatPersistence = (roomId) => {
  const storageKey = `${KEY_PREFIX}${roomId}`;

  const loadMessages = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const saveMessages = useCallback((messages) => {
    try {
      const trimmed = messages.slice(-MAX_MESSAGES);
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      // Storage quota exceeded — silently ignore
    }
  }, [storageKey]);

  const clearMessages = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { loadMessages, saveMessages, clearMessages };
};

export default useChatPersistence;
