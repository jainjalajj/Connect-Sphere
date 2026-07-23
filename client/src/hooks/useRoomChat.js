/**
 * useRoomChat — manages all chat and reaction logic for a room.
 *
 * Extracted from Room.jsx to keep the component focused on UI layout.
 * Handles: message encryption/decryption, persistence, unread count,
 *          socket listeners, and emoji reactions.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../utils/socket';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { useChatPersistence } from './useChatPersistence';

/**
 * @param {object} opts
 * @param {string}   opts.roomId
 * @param {string}   opts.username
 * @param {object}   opts.cryptoKeyPromiseRef  – ref holding a Promise<CryptoKey>
 * @param {boolean}  opts.isChatVisible        – whether the chat panel is visible
 * @param {Function} opts.playSound            – (type) => void
 */
export function useRoomChat({
  roomId,
  username,
  cryptoKeyPromiseRef,
  isChatVisible,
  playSound,
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages]                   = useState([]);
  const [message, setMessage]                     = useState('');
  const [unreadCount, setUnreadCount]             = useState(0);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // ── Persistence ────────────────────────────────────────────────────────────
  const { loadMessages, saveMessages } = useChatPersistence(roomId);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length) setMessages(saved);
  }, [loadMessages]);

  // Persist whenever messages change
  useEffect(() => {
    if (messages.length) saveMessages(messages);
  }, [messages, saveMessages]);

  // ── Unread count ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isChatVisible) setUnreadCount(0);
  }, [isChatVisible]);

  // Ref so socket closure always sees fresh isChatVisible
  const isChatVisibleRef = useRef(isChatVisible);
  useEffect(() => { isChatVisibleRef.current = isChatVisible; }, [isChatVisible]);

  const playSoundRef = useRef(playSound);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const onReceiveMessage = async (data) => {
      const key = await cryptoKeyPromiseRef.current;
      const decrypted = await decryptMessage(data.message, key);
      setMessages(prev => {
        // Deduplicate — skip if id already present
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, { ...data, message: decrypted }];
      });
      // Use ref so this closure always has the current isChatVisible value
      if (!isChatVisibleRef.current) {
        setUnreadCount(c => c + 1);
        playSoundRef.current('message');
      }
    };

    const onReactionReceived = ({ username: rUser, emoji }) => {
      const id = Date.now() + Math.random();
      setFloatingReactions(prev => [...prev, { id, emoji, username: rUser }]);
      playSoundRef.current('reaction');
    };

    // Receive server-side cached messages (on room-data event)
    const onRoomMessages = async (decryptedMessages) => {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const merged = [...prev];
        decryptedMessages.forEach(m => { if (!ids.has(m.id)) merged.push(m); });
        merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return merged;
      });
    };

    socket.on('receive-message',     onReceiveMessage);
    socket.on('reaction-received',   onReactionReceived);
    // Room.jsx will call mergeServerMessages directly after decrypting room-data
    socket._roomChatMerge = onRoomMessages;

    return () => {
      socket.off('receive-message',   onReceiveMessage);
      socket.off('reaction-received', onReactionReceived);
      delete socket._roomChatMerge;
    };
  }, [roomId, cryptoKeyPromiseRef]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!message.trim()) return;
    const key = await cryptoKeyPromiseRef.current;
    const encryptedMessage = await encryptMessage(message.trim(), key);
    socket.emit('send-message', {
      roomId,
      username,
      message: encryptedMessage,
      timestamp: new Date().toISOString(),
    });
    setMessage('');
  }, [message, roomId, username, cryptoKeyPromiseRef]);

  const sendReaction = useCallback((emoji) => {
    socket.emit('send-reaction', { roomId, username, emoji });
  }, [roomId, username]);

  const removeFloatingReaction = useCallback((id) => {
    setFloatingReactions(prev => prev.filter(r => r.id !== id));
  }, []);

  /**
   * Called by Room.jsx after decrypting messages from the `room-data` event.
   * Merges server messages with local cache, deduplicating by id.
   */
  const mergeServerMessages = useCallback((decryptedMessages) => {
    setMessages(prev => {
      const ids = new Set(prev.map(m => m.id));
      const merged = [...prev];
      decryptedMessages.forEach(m => { if (!ids.has(m.id)) merged.push(m); });
      merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return merged;
    });
  }, []);

  return {
    // State
    messages,
    message, setMessage,
    unreadCount, setUnreadCount,
    floatingReactions,
    // Actions
    sendMessage,
    sendReaction,
    removeFloatingReaction,
    mergeServerMessages,
  };
}
