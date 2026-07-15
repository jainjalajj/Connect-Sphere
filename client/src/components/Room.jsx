import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Badge,
  Divider,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Tooltip,
  Fab,
  BottomNavigation,
  BottomNavigationAction,
  Slide,
} from '@mui/material';
import {
  Videocam as VideoIcon,
  VideocamOff as VideoOffIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CallEnd as CallEndIcon,
  Send as SendIcon,
  People as PeopleIcon,
  Chat as ChatIcon,
  ExitToApp as ExitIcon,
  ContentCopy as CopyIcon,
  FiberManualRecord as RecordIcon,
  Stop as StopIcon,
  PanTool as RaiseHandIcon,
  EmojiEmotions as EmojiIcon,
  Close as CloseIcon,
  VideoCall as VideoCallIcon,
  BlurOn as BlurOnIcon,
} from '@mui/icons-material';
import socket from '../utils/socket';
import { CONFIG } from '../config';
import { sounds } from '../hooks/useSound';
import { useChatPersistence } from '../hooks/useChatPersistence';
import { useVirtualBackground } from '../hooks/useVirtualBackground';
import VirtualBackgroundPanel from './VirtualBackgroundPanel';
import { deriveKeyFromPassword, importEncryptionKey, encryptMessage, decryptMessage } from '../utils/crypto';
import AnnotationCanvas from './AnnotationCanvas';

// ─── Emoji Reactions ────────────────────────────────────────────────────────
const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

// ─── Inline VideoPlayer ──────────────────────────────────────────────────────
const VideoPlayer = forwardRef(({
  stream, username, isLocal = false,
  isAudioEnabled = true, isVideoEnabled = true,
  isScreenSharing = false, avatarColor = '#6366f1',
  handRaised = false, userId, roomId,
  variant = 'large', // 'large' | 'thumb'
  isFeatured = false,
  onClick,
}, ref) => {
  const videoRef = useRef(null);
  const resolvedRef = ref || videoRef;

  useEffect(() => {
    const el = resolvedRef.current;
    if (el && stream) {
      el.srcObject = stream;
      el.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  }, [stream, resolvedRef]);

  const initials = username?.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';

  if (variant === 'thumb') {
    return (
      <Box
        className={`thumb-tile${isFeatured ? ' active-speaker' : ''}`}
        onClick={onClick}
        sx={{
          position: 'relative',
          width: 80, height: 80,
          borderRadius: '16px',
          overflow: 'hidden',
          flexShrink: 0,
          border: isFeatured ? '2px solid #6366f1' : '2px solid transparent',
          boxShadow: isFeatured
            ? '0 0 0 3px #6366f1, 0 4px 16px rgba(99,102,241,0.25)'
            : '0 2px 8px rgba(0,0,0,0.12)',
          background: isVideoEnabled && stream ? '#000' : avatarColor,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {isLocal && <style>{`.local-video-mirror video { transform: scaleX(-1); }`}</style>}
        <video
          ref={resolvedRef}
          autoPlay playsInline muted={isLocal}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: isVideoEnabled && stream ? 'block' : 'none',
          }}
        />
        {(!isVideoEnabled || !stream) && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: avatarColor,
          }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
              {initials}
            </Typography>
          </Box>
        )}
        {/* Name tag */}
        <Box sx={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
          px: 0.75, py: 0.5,
        }}>
          <Typography variant="caption" sx={{
            color: '#fff', fontSize: 9, fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isLocal ? 'You' : username?.split(' ')[0]}
          </Typography>
        </Box>
        {!isAudioEnabled && (
          <MicOffIcon sx={{ position: 'absolute', top: 4, right: 4, fontSize: 10, color: '#ef4444', bgcolor: 'rgba(255,255,255,0.9)', borderRadius: '50%', p: 0.25 }} />
        )}
        {roomId && userId && (
          <AnnotationCanvas roomId={roomId} targetUserId={userId} color={avatarColor} isLocal={isLocal} />
        )}
      </Box>
    );
  }

  // Large / featured view
  return (
    <Box
      className={isLocal ? 'local-video-mirror' : undefined}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '20px',
        overflow: 'hidden',
        background: isVideoEnabled && stream ? '#000' : `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}44)`,
        boxShadow: '0 8px 40px rgba(99,102,241,0.15)',
        border: '1px solid #e0e7ff',
        flexShrink: 0,
      }}
    >
      {isLocal && <style>{`.local-video-mirror video { transform: scaleX(-1); }`}</style>}
      <video
        ref={resolvedRef}
        autoPlay playsInline muted={isLocal}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: isVideoEnabled && stream ? 'block' : 'none',
          borderRadius: '20px',
        }}
      />
      {roomId && userId && (
        <AnnotationCanvas roomId={roomId} targetUserId={userId} color={avatarColor} isLocal={isLocal} />
      )}
      {(!isVideoEnabled || !stream) && (
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${avatarColor}15, #f8f9ff)`,
        }}>
          <Avatar sx={{
            width: 96, height: 96, fontSize: 36,
            backgroundColor: avatarColor, mb: 2,
            fontFamily: "'Outfit', sans-serif", fontWeight: 700,
            boxShadow: `0 8px 32px ${avatarColor}55`,
          }}>
            {initials}
          </Avatar>
          <Typography variant="h6" sx={{ color: '#1e1b4b', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
            {username}
          </Typography>
          <Typography variant="caption" color="text.secondary">Camera off</Typography>
        </Box>
      )}
      {/* Bottom overlay bar */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
        px: 2, py: 1.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Typography variant="subtitle2" sx={{
          color: '#fff', fontWeight: 700,
          fontFamily: "'Outfit', sans-serif",
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          {username}{isLocal ? ' (You)' : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {handRaised && <span style={{ fontSize: 16 }}>✋</span>}
          {isScreenSharing && <ScreenShareIcon sx={{ color: '#f59e0b', fontSize: 16 }} />}
          {!isAudioEnabled && (
            <Box sx={{ bgcolor: '#ef4444', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MicOffIcon sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}
          {!isVideoEnabled && (
            <Box sx={{ bgcolor: '#ef4444', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <VideoOffIcon sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
});
VideoPlayer.displayName = 'VideoPlayer';


// ─── FloatingReaction ────────────────────────────────────────────────────────
const FloatingReaction = ({ emoji, username, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Box sx={{
      position: 'fixed',
      bottom: 120,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      animation: 'floatUp 2.5s ease forwards',
      pointerEvents: 'none',
      zIndex: 9999,
      '@keyframes floatUp': {
        '0%': { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
        '100%': { opacity: 0, transform: 'translateX(-50%) translateY(-120px) scale(1.6)' },
      },
    }}>
      <Typography sx={{ fontSize: 40, lineHeight: 1 }}>{emoji}</Typography>
      <Typography variant="caption" color="white" sx={{
        bgcolor: 'rgba(0,0,0,0.6)', px: 1, borderRadius: 1, mt: 0.5,
      }}>
        {username}
      </Typography>
    </Box>
  );
};

// ─── Main Room Component ─────────────────────────────────────────────────────
const Room = ({ username, roomId, password, e2eKey, maxParticipants = 8, avatarColor = '#5865f2', startWithVideo = true, startWithAudio = true, onLeave }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── State ──────────────────────────────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [mobileTab, setMobileTab] = useState(0); // 0=video 1=chat 2=people
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatFocused, setChatFocused] = useState(false);
  // Push-to-talk
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  // Raise hand
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState(new Map()); // userId -> username
  // Reactions
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]); // [{id, emoji, username}]
  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Virtual background
  const [showVBGPanel, setShowVBGPanel] = useState(false);
  // Featured speaker (speaker-view layout)
  const [featuredUserId, setFeaturedUserId] = useState('local'); // 'local' | userId string

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const messagesEndRef = useRef(null);
  const localStreamRef = useRef(null); // stable ref for closures
  const pendingIceCandidates = useRef(new Map()); // userId -> Array of ICE candidates

  // E2EE Crypto Key Promise
  const cryptoKeyPromiseRef = useRef(null);
  if (!cryptoKeyPromiseRef.current) {
    if (password) {
      cryptoKeyPromiseRef.current = deriveKeyFromPassword(password, roomId);
    } else if (e2eKey) {
      cryptoKeyPromiseRef.current = importEncryptionKey(e2eKey);
    } else {
      cryptoKeyPromiseRef.current = deriveKeyFromPassword(roomId, 'fallback');
    }
  }

  const { loadMessages, saveMessages } = useChatPersistence(roomId);

  // Virtual background — processes rawStream → processedStream via TF.js
  const {
    processedStream,
    isLoading: vbgLoading,
    error: vbgError,
    currentBg,
    setBackground,
  } = useVirtualBackground(localStream);

  // When processedStream changes (VBG on/off), update WebRTC tracks
  useEffect(() => {
    // The active stream is processedStream when VBG is on, else localStream
    const activeStream = processedStream || localStream;
    if (!activeStream) return;

    // Update peer connection video tracks
    peerConnections.current.forEach(pc => {
      activeStream.getVideoTracks().forEach(newTrack => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
    });
    // Update local video preview
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = activeStream;
    }
  }, [processedStream, localStream]);

  const pcConfig = {
    iceServers: CONFIG.ICE_SERVERS || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showSnackbar = useCallback((msg, severity = 'info') => {
    setSnackbar({ open: true, message: msg, severity });
  }, []);

  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    sounds[type]?.();
  }, [soundEnabled]);

  const copyRoomLink = useCallback(() => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}${e2eKey ? `#key=${e2eKey}` : ''}`;
    navigator.clipboard.writeText(link)
      .then(() => showSnackbar('Room link copied!', 'success'));
  }, [roomId, e2eKey, showSnackbar]);

  // ── Chat persistence & unread ──────────────────────────────────────────────
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length) setMessages(saved);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length) saveMessages(messages);
  }, [messages, saveMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track unread messages when chat is not focused
  const isChatVisible = isMobile ? mobileTab === 1 : true;
  useEffect(() => {
    if (!isChatVisible) {
      // will increment on new messages below
    } else {
      setUnreadCount(0);
    }
  }, [isChatVisible]);

  // ── Stable refs for values used inside socket closures ────────────────────
  const isInCallRef = useRef(false);
  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);

  const showSnackbarRef = useRef(showSnackbar);
  useEffect(() => { showSnackbarRef.current = showSnackbar; }, [showSnackbar]);

  const playSoundRef = useRef(playSound);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);
  const startSpeaking = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = true;
      setPttActive(true);
      // Note: don't call setIsAudioEnabled — that's the persistent mute state.
      // PTT only temporarily enables the track.
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = false;
      setPttActive(false);
    }
  }, []);

  useEffect(() => {
    if (!isPushToTalk) return;

    const handleKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      // Don't fire while user is typing in an input or textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      startSpeaking();
    };
    const handleKeyUp = (e) => {
      if (e.code !== 'Space') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      stopSpeaking();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPushToTalk, startSpeaking, stopSpeaking]);

  const togglePushToTalk = useCallback(() => {
    const next = !isPushToTalk;
    setIsPushToTalk(next);
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (next) {
      // Turning PTT ON — mute mic immediately (user must hold Space/button to speak)
      if (track) { track.enabled = false; setIsAudioEnabled(false); }
      showSnackbar('Push-to-talk ON — hold Space or the button to speak', 'info');
    } else {
      // Turning PTT OFF — restore mic, clear any active speaking state
      setPttActive(false);
      if (track) { track.enabled = true; setIsAudioEnabled(true); }
      showSnackbar('Push-to-talk OFF — mic is live', 'info');
    }
  }, [isPushToTalk]);

  // ── WebRTC helpers ─────────────────────────────────────────────────────────
  const createPeerConnection = useCallback((userId) => {
    const pc = new RTCPeerConnection(pcConfig);

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams(prev => new Map(prev).set(userId, stream));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { target: userId, candidate: event.candidate, roomId });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Room init & socket listeners ───────────────────────────────────────────
  useEffect(() => {
    socket.emit('join-room', roomId, username, password || null, maxParticipants);

    const onRoomData = async (data) => {
      const otherUsers = (data.users || []).filter(u => u.id !== socket.id);
      setParticipants(otherUsers);
      if (data.messages?.length) {
        const key = await cryptoKeyPromiseRef.current;
        const decryptedMessages = await Promise.all(data.messages.map(async (m) => ({
          ...m,
          message: await decryptMessage(m.message, key)
        })));
        
        setMessages(prev => {
          // Merge server messages with local cache, deduplicate by id
          const ids = new Set(prev.map(m => m.id));
          const merged = [...prev];
          decryptedMessages.forEach(m => { if (!ids.has(m.id)) merged.push(m); });
          merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          return merged;
        });
      }
    };

    const onUserJoined = (data) => {
      setParticipants(prev => {
        if (prev.some(p => p.id === data.id)) return prev;
        return [...prev, data];
      });
      showSnackbarRef.current(`${data.username} joined`, 'success');
      playSoundRef.current('userJoined');
    };

    const processQueuedCandidates = async (userId, pc) => {
      const candidates = pendingIceCandidates.current.get(userId) || [];
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding queued ICE candidate:', e);
        }
      }
      pendingIceCandidates.current.delete(userId);
    };

    const onUserLeft = (data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.id));
      setRemoteStreams(prev => { const m = new Map(prev); m.delete(data.id); return m; });
      setRaisedHands(prev => { const m = new Map(prev); m.delete(data.id); return m; });
      pendingIceCandidates.current.delete(data.id);
      const pc = peerConnections.current.get(data.id);
      if (pc) { pc.close(); peerConnections.current.delete(data.id); }
      showSnackbarRef.current(`${data.username} left`, 'warning');
      playSoundRef.current('userLeft');
    };

    const onReceiveMessage = async (data) => {
      const key = await cryptoKeyPromiseRef.current;
      const decrypted = await decryptMessage(data.message, key);
      const dataWithDecrypted = { ...data, message: decrypted };
      setMessages(prev => [...prev, dataWithDecrypted]);
      if (!isChatVisible) {
        setUnreadCount(c => c + 1);
        playSoundRef.current('message');
      }
    };

    const onJoinError = (msg) => {
      showSnackbarRef.current(msg, 'error');
      onLeave();
    };

    const onReactionReceived = ({ username: rUser, emoji }) => {
      const id = Date.now() + Math.random();
      setFloatingReactions(prev => [...prev, { id, emoji, username: rUser }]);
      playSoundRef.current('reaction');
    };

    const onUserStartedCall = async (data) => {
      const stream = localStreamRef.current;
      if (!stream || !isInCallRef.current) return;
      let pc = peerConnections.current.get(data.userId);
      if (!pc) {
        pc = createPeerConnection(data.userId);
        peerConnections.current.set(data.userId, pc);
      }
      stream.getTracks().forEach(t => {
        const alreadyAdded = pc.getSenders().some(s => s.track === t);
        if (!alreadyAdded) pc.addTrack(t, stream);
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { target: data.userId, offer, roomId });
    };

    const onOffer = async ({ sender, offer }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      let pc = peerConnections.current.get(sender);
      if (!pc) {
        pc = createPeerConnection(sender);
        peerConnections.current.set(sender, pc);
      }
      stream.getTracks().forEach(t => {
        const alreadyAdded = pc.getSenders().some(s => s.track === t);
        if (!alreadyAdded) pc.addTrack(t, stream);
      });
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedCandidates(sender, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: sender, answer, roomId });
    };

    const onAnswer = async ({ sender, answer }) => {
      const pc = peerConnections.current.get(sender);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await processQueuedCandidates(sender, pc);
      }
    };

    const onIceCandidate = async ({ sender, candidate }) => {
      const pc = peerConnections.current.get(sender);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else {
        if (!pendingIceCandidates.current.has(sender)) {
          pendingIceCandidates.current.set(sender, []);
        }
        pendingIceCandidates.current.get(sender).push(candidate);
      }
    };

    const onCallEnded = (data) => {
      if (data.userId) {
        setRemoteStreams(prev => { const m = new Map(prev); m.delete(data.userId); return m; });
        const pc = peerConnections.current.get(data.userId);
        if (pc) { pc.close(); peerConnections.current.delete(data.userId); }
      }
      showSnackbar(`Call ended by ${data.username || 'remote user'}`, 'info');
    };

    socket.on('room-data', onRoomData);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('receive-message', onReceiveMessage);
    socket.on('join-error', onJoinError);
    socket.on('reaction-received', onReactionReceived);
    socket.on('user-started-call', onUserStartedCall);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('call-ended', onCallEnded);

    return () => {
      socket.off('room-data', onRoomData);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('receive-message', onReceiveMessage);
      socket.off('join-error', onJoinError);
      socket.off('reaction-received', onReactionReceived);
      socket.off('user-started-call', onUserStartedCall);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('call-ended', onCallEnded);

      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      pendingIceCandidates.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username]);

  // ── Raise hand — separate effect so it always has fresh state ─────────────
  useEffect(() => {
    const onHandRaised = ({ userId, username: rUser, raised }) => {
      setRaisedHands(prev => {
        const m = new Map(prev);
        if (raised) m.set(userId, rUser);
        else m.delete(userId);
        return m;
      });
      if (raised) showSnackbarRef.current(`${rUser} raised their hand ✋`, 'info');
    };
    socket.on('hand-raised', onHandRaised);
    return () => socket.off('hand-raised', onHandRaised);
  }); // no dep array — re-registers every render so closure is always fresh

  // ── Media ──────────────────────────────────────────────────────────────────
  const getUserMedia = async (video = true, audio = true) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
    });
    stream.getTracks().forEach(t => { t.enabled = true; });
    return stream;
  };

  const startCall = async (withVideo) => {
    try {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await getUserMedia(withVideo, true);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoEnabled(withVideo);
      setIsAudioEnabled(true);
      setIsInCall(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }
      socket.emit('start-call', { roomId, type: withVideo ? 'video' : 'voice', username });
      showSnackbar(withVideo ? 'Video call started' : 'Voice call started', 'success');
    } catch (err) {
      showSnackbar(err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : 'Failed to start call', 'error');
      setIsInCall(false);
    }
  };

  useEffect(() => {
    // Auto-start call on mount if requested
    if (startWithVideo || startWithAudio) {
      startCall(startWithVideo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoEnabled(track.enabled); }
  };

  const toggleAudio = () => {
    if (isPushToTalk) return; // PTT controls audio
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsAudioEnabled(track.enabled); }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
        if (localStreamRef.current) {
          const old = localStreamRef.current.getVideoTracks()[0];
          if (old) { localStreamRef.current.removeTrack(old); old.stop(); }
          localStreamRef.current.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsScreenSharing(true);
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          restartCamera();
        };
      } else {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.stop(); localStreamRef.current.removeTrack(track); }
        setIsScreenSharing(false);
        restartCamera();
      }
    } catch (err) {
      showSnackbar('Screen sharing failed', 'error');
    }
  };

  const restartCamera = async () => {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      const videoTrack = vs.getVideoTracks()[0];
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
      localStreamRef.current?.addTrack(videoTrack);
      setLocalStream(new MediaStream(localStreamRef.current?.getTracks() || []));
      setIsVideoEnabled(true);
    } catch (e) { /* camera unavailable */ }
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    setIsScreenSharing(false);
    setIsInCall(false);
    socket.emit('end-call', { roomId, username });
    showSnackbar('Call ended', 'info');
  };

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = () => {
    const stream = localStreamRef.current;
    if (!stream) { showSnackbar('Start a call before recording', 'warning'); return; }
    try {
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ConnectSphere_${roomId}_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        showSnackbar('Recording saved', 'success');
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      showSnackbar('Recording started', 'info');
    } catch (err) {
      showSnackbar('Recording not supported in this browser', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  // ── Raise hand ─────────────────────────────────────────────────────────────
  const toggleRaiseHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    socket.emit('raise-hand', { roomId, username, raised: next });
  };

  // ── Reactions ──────────────────────────────────────────────────────────────
  const sendReaction = (emoji) => {
    socket.emit('send-reaction', { roomId, username, emoji });
    setShowReactionPicker(false);
  };

  const removeFloatingReaction = useCallback((id) => {
    setFloatingReactions(prev => prev.filter(r => r.id !== id));
  }, []);


  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const key = await cryptoKeyPromiseRef.current;
    const encryptedMessage = await encryptMessage(message.trim(), key);
    
    socket.emit('send-message', {
      roomId, username,
      message: encryptedMessage,
      timestamp: new Date().toISOString(),
    });
    setMessage('');
  };

  const getAvatarColor = (name) => {
    const colors = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
      '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#ffc107','#ff9800','#ff5722'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Defined as JSX variables (NOT inner components) to prevent remount on every
  // state change — inner const Foo = () => components cause React to treat them
  // as new types each render, which unmounts inputs and steals focus.
  const controlBar = (
    <Box sx={{
      display: 'flex', gap: 1, flexWrap: 'wrap',
      justifyContent: 'center', alignItems: 'center',
    }}>
      {/* Start call buttons (only when not in call) */}
      {!isInCall && (
        <>
          <Tooltip title="Start video call">
            <Fab size="small" color="primary" onClick={() => startCall(true)}>
              <VideoIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Start voice call">
            <Fab size="small" color="secondary" onClick={() => startCall(false)}>
              <MicIcon />
            </Fab>
          </Tooltip>
        </>
      )}

      {isInCall && (
        <>
          {/* Mic */}
          <Tooltip title={isPushToTalk ? `PTT: ${pttActive ? 'Speaking' : 'Hold Space'}` : (isAudioEnabled ? 'Mute' : 'Unmute')}>
            <Fab
              size="small"
              className="ctrl-btn"
              onClick={toggleAudio}
              sx={{
                backgroundColor: isPushToTalk
                  ? (pttActive ? '#10b981' : '#f59e0b')
                  : (isAudioEnabled ? '#10b981' : '#ef4444'),
                color: 'white',
                '&:hover': { backgroundColor: 'inherit' },
              }}
            >
              {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
            </Fab>
          </Tooltip>

          {/* Video */}
          <Tooltip title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
            <Fab size="small"
              className="ctrl-btn"
              sx={{
                backgroundColor: isVideoEnabled ? '#10b981' : '#ef4444',
                color: 'white', '&:hover': { backgroundColor: 'inherit' },
              }}
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <VideoIcon /> : <VideoOffIcon />}
            </Fab>
          </Tooltip>

          {/* Screen share */}
          <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            <Fab size="small" className="ctrl-btn"
              sx={{
                backgroundColor: isScreenSharing ? '#6366f1' : '#f1f5f9',
                color: isScreenSharing ? 'white' : '#6366f1',
                border: '1px solid',
                borderColor: '#c7d2fe',
                '&:hover': { backgroundColor: '#6366f1', color: 'white' },
              }}
              onClick={toggleScreenShare}
            >
              {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </Fab>
          </Tooltip>

          {/* Record */}
          <Tooltip title={isRecording ? 'Stop recording' : 'Start recording'}>
            <Fab size="small" className="ctrl-btn"
              sx={{
                backgroundColor: isRecording ? '#ef4444' : '#f1f5f9',
                color: isRecording ? 'white' : '#ef4444',
                border: '1px solid',
                borderColor: '#fecaca',
                animation: isRecording ? 'recPulse 1.2s infinite' : 'none',
              }}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <StopIcon /> : <RecordIcon />}
            </Fab>
          </Tooltip>

          {/* PTT toggle */}
          <Tooltip title={isPushToTalk ? 'Disable push-to-talk' : 'Enable push-to-talk (Space)'}>
            <Chip
              label="PTT"
              size="small"
              color={isPushToTalk ? 'warning' : 'default'}
              onClick={togglePushToTalk}
              sx={{ cursor: 'pointer', fontWeight: 700 }}
            />
          </Tooltip>

          {/* PTT Touch Button for Mobile/Touch devices */}
          {isPushToTalk && (
            <Button
              variant="contained"
              size="small"
              color={pttActive ? "success" : "warning"}
              onMouseDown={startSpeaking}
              onMouseUp={stopSpeaking}
              onMouseLeave={stopSpeaking}
              onTouchStart={(e) => { e.preventDefault(); startSpeaking(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopSpeaking(); }}
              sx={{
                borderRadius: 4,
                px: 2,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                userSelect: 'none',
                touchAction: 'none',
                height: 24,
              }}
            >
              {pttActive ? "🗣️ SPEAKING" : "🎙️ HOLD TO SPEAK"}
            </Button>
          )}

          {/* End call */}
          <Tooltip title="End call">
            <Fab size="small" sx={{ backgroundColor: 'error.main', color: 'white' }} onClick={endCall}>
              <CallEndIcon />
            </Fab>
          </Tooltip>
        </>
      )}

      {/* Raise hand */}
      <Tooltip title={handRaised ? 'Lower hand' : 'Raise hand'}>
        <Fab size="small"
          sx={{
            backgroundColor: handRaised ? 'warning.main' : 'background.paper',
            color: handRaised ? 'white' : 'text.secondary',
            border: handRaised ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
          onClick={toggleRaiseHand}
        >
          <RaiseHandIcon />
        </Fab>
      </Tooltip>

      {/* Reactions */}
      <Box sx={{ position: 'relative' }}>
        <Tooltip title="Send reaction">
          <Fab size="small"
            sx={{
              backgroundColor: 'background.paper',
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
            }}
            onClick={() => setShowReactionPicker(p => !p)}
          >
            <EmojiIcon />
          </Fab>
        </Tooltip>
        {showReactionPicker && (
          <Paper elevation={8} sx={{
            position: 'absolute', bottom: 52, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: 0.5, p: 1, borderRadius: 3,
            zIndex: 100,
          }}>
            {REACTIONS.map(emoji => (
              <Box
                key={emoji}
                onClick={() => sendReaction(emoji)}
                sx={{
                  fontSize: 24, cursor: 'pointer',
                  transition: 'transform 0.1s',
                  '&:hover': { transform: 'scale(1.3)' },
                }}
              >
                {emoji}
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      {/* Copy link */}
      <Tooltip title="Copy room link">
        <Fab size="small"
          sx={{ backgroundColor: 'background.paper', color: 'primary.main', border: '1px solid', borderColor: 'primary.main' }}
          onClick={copyRoomLink}
        >
          <CopyIcon />
        </Fab>
      </Tooltip>

      {/* Sound toggle */}
      <Tooltip title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
        <Chip
          label={soundEnabled ? '🔔' : '🔕'}
          size="small"
          onClick={() => setSoundEnabled(p => !p)}
          sx={{ cursor: 'pointer', fontSize: 16 }}
        />
      </Tooltip>

      {/* Virtual Background */}
      <Tooltip title={showVBGPanel ? 'Hide background effects' : 'Background effects'}>
        <Fab
          size="small"
          onClick={() => setShowVBGPanel(p => !p)}
          sx={{
            backgroundColor: showVBGPanel ? 'primary.main' : (currentBg.type !== 'none' ? 'rgba(88,101,242,0.3)' : 'background.paper'),
            color: showVBGPanel ? 'white' : (currentBg.type !== 'none' ? 'primary.light' : 'text.secondary'),
            border: showVBGPanel ? 'none' : '1px solid',
            borderColor: currentBg.type !== 'none' ? 'primary.main' : 'divider',
            position: 'relative',
          }}
        >
          <BlurOnIcon />
          {vbgLoading && (
            <Box sx={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid', borderColor: 'primary.light',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
            }} />
          )}
        </Fab>
      </Tooltip>

      {/* Leave */}
      <Tooltip title="Leave room">
        <Fab size="small" sx={{ backgroundColor: 'error.dark', color: 'white', ml: 1 }} onClick={onLeave}>
          <ExitIcon />
        </Fab>
      </Tooltip>
    </Box>
  );

  // Video section
  const videoSection = (
    <Box sx={{
      display: 'flex', gap: 1.5, p: 1.5,
      overflowX: 'auto',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      flex: 1,
      minHeight: isMobile ? 200 : 0,
      background: 'radial-gradient(ellipse at 10% 10%, rgba(88,101,242,0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 90%, rgba(235,69,158,0.05) 0%, transparent 50%), #0a0a0f',
    }}>
      {isInCall && (
        <VideoPlayer
          ref={localVideoRef}
          stream={processedStream || localStream}
          username={`${username} (You)`}
          isLocal
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
          avatarColor={avatarColor}
          handRaised={handRaised}
          userId={socket.id}
          roomId={roomId}
        />
      )}
      {Array.from(remoteStreams).map(([userId, stream]) => {
        const p = participants.find(x => x.id === userId);
        return (
          <VideoPlayer
            key={userId}
            stream={stream}
            username={p?.username || 'Unknown'}
            isLocal={false}
            isAudioEnabled
            isVideoEnabled
            avatarColor={getAvatarColor(p?.username)}
            handRaised={raisedHands.has(userId)}
            userId={userId}
            roomId={roomId}
          />
        );
      })}
      {!isInCall && (
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
          minHeight: 200,
        }}>
          <Typography color="text.secondary">No active call</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" startIcon={<VideoIcon />} onClick={() => startCall(true)}>
              Start Video
            </Button>
            <Button variant="outlined" startIcon={<MicIcon />} onClick={() => startCall(false)}>
              Start Voice
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );

  // Chat section
  const chatSection = (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{
        p: 1.5, borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <ChatIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>Chat</Typography>
        {unreadCount > 0 && (
          <Chip label={unreadCount} size="small" color="error" sx={{ height: 20, fontSize: 11 }} />
        )}
      </Box>

      <Box sx={{
        flex: 1, overflow: 'auto', p: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: '#c7d2fe', borderRadius: 2 },
        background: '#f8f9ff',
      }}>
        {messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">No messages yet</Typography>
          </Box>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.username === username;
            return (
              <Box key={msg.id || i} sx={{
                mb: 1.5, display: 'flex',
                flexDirection: isOwn ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 1,
              }}>
                <Avatar sx={{
                  width: 28, height: 28, fontSize: 11, fontWeight: 700,
                  backgroundColor: isOwn ? avatarColor : getAvatarColor(msg.username),
                  flexShrink: 0,
                }}>
                  {msg.username?.[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ maxWidth: '75%' }}>
                  {(i === 0 || messages[i - 1].username !== msg.username) && (
                    <Typography variant="caption" color="text.secondary" sx={{
                      display: 'block', mb: 0.3,
                      textAlign: isOwn ? 'right' : 'left',
                      fontWeight: 600,
                      color: isOwn ? avatarColor : getAvatarColor(msg.username),
                    }}>
                      {msg.username}
                    </Typography>
                  )}
                  <Paper elevation={1} sx={{
                    px: 1.5, py: 1,
                    backgroundColor: isOwn ? 'primary.main' : 'background.default',
                    color: isOwn ? 'white' : 'text.primary',
                    borderRadius: 2,
                    borderTopRightRadius: isOwn ? 4 : 12,
                    borderTopLeftRadius: isOwn ? 12 : 4,
                    wordBreak: 'break-word',
                  }}>
                    <Typography variant="body2">{msg.message}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', textAlign: 'right', mt: 0.3 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth size="small"
          placeholder="Type a message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          onFocus={() => { setChatFocused(true); setUnreadCount(0); }}
          onBlur={() => setChatFocused(false)}
        />
        <IconButton color="primary" onClick={sendMessage} disabled={!message.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );

  // Participants panel
  const participantsPanel = (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Participants ({participants.length + 1})
      </Typography>
      <List dense>
        {/* Self */}
        <ListItem sx={{ px: 0 }}>
          <ListItemAvatar>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={handRaised ? '✋' : null}
            >
              <Avatar sx={{ width: 36, height: 36, backgroundColor: avatarColor, fontSize: 14 }}>
                {username[0]?.toUpperCase()}
              </Avatar>
            </Badge>
          </ListItemAvatar>
          <ListItemText
            primary={`${username} (You)`}
            secondary={
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.3 }}>
                {isInCall && <Chip size="small" label="In call" color="primary" sx={{ height: 18, fontSize: 10 }} />}
                {isVideoEnabled && <Chip size="small" label="Video" color="success" sx={{ height: 18, fontSize: 10 }} />}
              </Box>
            }
          />
        </ListItem>
        <Divider />
        {participants.map((p) => (
          <ListItem key={p.id} sx={{ px: 0 }}>
            <ListItemAvatar>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={raisedHands.has(p.id) ? '✋' : null}
              >
                <Avatar sx={{ width: 36, height: 36, backgroundColor: getAvatarColor(p.username), fontSize: 14 }}>
                  {p.username[0]?.toUpperCase()}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={p.username}
              secondary={<Chip size="small" label="Online" color="success" sx={{ height: 18, fontSize: 10 }} />}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    // Compute who is featured
    const featuredIsLocal = featuredUserId === 'local';
    const featuredStream = featuredIsLocal
      ? (processedStream || localStream)
      : remoteStreams.get(featuredUserId);
    const featuredParticipant = featuredIsLocal
      ? null
      : participants.find(x => x.id === featuredUserId);
    const featuredUsername = featuredIsLocal ? `${username} (You)` : (featuredParticipant?.username || 'Unknown');
    const featuredAvatarColor = featuredIsLocal ? avatarColor : getAvatarColor(featuredParticipant?.username);
    const featuredHandRaised = featuredIsLocal ? handRaised : raisedHands.has(featuredUserId);

    return (
      <Box sx={{ height: '100vh', display: 'flex', backgroundColor: '#f8f9ff', overflow: 'hidden' }}>

        {/* ── Left icon sidebar ── */}
        <Box sx={{
          width: 68, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          py: 2, gap: 1.5,
          background: '#ffffff',
          borderRight: '1px solid #e0e7ff',
        }}>
          {/* Logo */}
          <Box sx={{
            width: 40, height: 40, borderRadius: '12px',
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 1, boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
          }}>
            <VideoCallIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>

          <Divider sx={{ width: 32, mb: 0.5 }} />

          <Tooltip title="Participants" placement="right">
            <Box
              className="nav-icon"
              onClick={() => setParticipantsDrawerOpen(true)}
            >
              <Badge badgeContent={participants.length + 1} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 16, height: 16 } }}>
                <PeopleIcon fontSize="small" />
              </Badge>
            </Box>
          </Tooltip>

          <Tooltip title="Copy room link" placement="right">
            <Box className="nav-icon" onClick={copyRoomLink}>
              <CopyIcon fontSize="small" />
            </Box>
          </Tooltip>

          <Tooltip title={soundEnabled ? 'Mute sounds' : 'Enable sounds'} placement="right">
            <Box className="nav-icon" onClick={() => setSoundEnabled(p => !p)}>
              <Typography sx={{ fontSize: 18 }}>{soundEnabled ? '🔔' : '🔕'}</Typography>
            </Box>
          </Tooltip>

          <Tooltip title="Background effects" placement="right">
            <Box
              className={`nav-icon${showVBGPanel ? ' active' : ''}`}
              onClick={() => setShowVBGPanel(p => !p)}
            >
              <BlurOnIcon fontSize="small" />
            </Box>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Leave room" placement="right">
            <Box
              className="nav-icon"
              onClick={onLeave}
              sx={{ '&:hover': { background: '#fee2e2 !important', color: '#ef4444 !important' } }}
            >
              <ExitIcon fontSize="small" />
            </Box>
          </Tooltip>
        </Box>

        {/* ── Center: thumbnail strip + large speaker + control bar ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>

          {/* Top header bar */}
          <Box sx={{
            px: 3, py: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff', borderBottom: '1px solid #e0e7ff',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ letterSpacing: '-0.3px', fontFamily: "'Outfit', sans-serif" }}>
                ConnectSphere
              </Typography>
              <Chip
                label={`#${roomId}`}
                size="small"
                sx={{ bgcolor: '#eef2ff', color: '#6366f1', fontWeight: 600, fontSize: 11, height: 22 }}
              />
              {isRecording && (
                <Chip
                  label="● REC"
                  size="small"
                  color="error"
                  className="rec-pulse"
                  sx={{ height: 22, fontSize: 11 }}
                />
              )}
              {pttActive && (
                <Chip label="🎤 Speaking" size="small" color="success" sx={{ height: 22, fontSize: 11 }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
            </Typography>
          </Box>

          {/* Main video area + thumbnail strip */}
          <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

            {/* Thumbnail strip (left of main video) */}
            <Box sx={{
              width: 104, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              gap: 1.5, p: 1.5,
              overflowY: 'auto',
              background: '#f8f9ff',
              borderRight: '1px solid #e0e7ff',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { background: '#c7d2fe', borderRadius: 2 },
            }}>
              {/* Local thumbnail */}
              {isInCall && (
                <VideoPlayer
                  ref={featuredUserId === 'local' ? localVideoRef : undefined}
                  stream={processedStream || localStream}
                  username={`${username} (You)`}
                  isLocal
                  isAudioEnabled={isAudioEnabled}
                  isVideoEnabled={isVideoEnabled}
                  isScreenSharing={isScreenSharing}
                  avatarColor={avatarColor}
                  handRaised={handRaised}
                  userId={socket.id}
                  roomId={roomId}
                  variant="thumb"
                  isFeatured={featuredUserId === 'local'}
                  onClick={() => setFeaturedUserId('local')}
                />
              )}
              {/* Remote thumbnails */}
              {Array.from(remoteStreams).map(([uid, stream]) => {
                const p = participants.find(x => x.id === uid);
                return (
                  <VideoPlayer
                    key={uid}
                    stream={stream}
                    username={p?.username || 'Unknown'}
                    isLocal={false}
                    isAudioEnabled
                    isVideoEnabled
                    avatarColor={getAvatarColor(p?.username)}
                    handRaised={raisedHands.has(uid)}
                    userId={uid}
                    roomId={roomId}
                    variant="thumb"
                    isFeatured={featuredUserId === uid}
                    onClick={() => setFeaturedUserId(uid)}
                  />
                );
              })}
            </Box>

            {/* Large featured speaker */}
            <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {isInCall ? (
                <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                  <VideoPlayer
                    ref={featuredIsLocal ? localVideoRef : undefined}
                    stream={featuredStream}
                    username={featuredUsername}
                    isLocal={featuredIsLocal}
                    isAudioEnabled={featuredIsLocal ? isAudioEnabled : true}
                    isVideoEnabled={featuredIsLocal ? isVideoEnabled : true}
                    isScreenSharing={featuredIsLocal ? isScreenSharing : false}
                    avatarColor={featuredAvatarColor}
                    handRaised={featuredHandRaised}
                    userId={featuredIsLocal ? socket.id : featuredUserId}
                    roomId={roomId}
                    variant="large"
                  />
                </Box>
              ) : (
                <Box sx={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 3, borderRadius: '20px',
                  border: '2px dashed #e0e7ff',
                  background: '#fff',
                }}>
                  <Box sx={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <VideoCallIcon sx={{ fontSize: 36, color: '#818cf8' }} />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="text.primary" gutterBottom>
                      Ready to connect?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start a call to see everyone here
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="contained" startIcon={<VideoIcon />} onClick={() => startCall(true)}>
                      Start Video
                    </Button>
                    <Button variant="outlined" startIcon={<MicIcon />} onClick={() => startCall(false)}>
                      Voice Only
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Floating control bar */}
              <Box sx={{
                mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
                flexWrap: 'wrap',
              }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 2.5, py: 1.25,
                  borderRadius: '999px',
                  background: '#ffffff',
                  border: '1px solid #e0e7ff',
                  boxShadow: '0 4px 24px rgba(99,102,241,0.12)',
                }}>
                  {controlBar}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Right chat panel ── */}
        <Box sx={{
          width: 340, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: '#ffffff',
          borderLeft: '1px solid #e0e7ff',
        }}>
          {/* Chat header */}
          <Box sx={{
            px: 2.5, py: 2,
            display: 'flex', alignItems: 'center', gap: 1,
            borderBottom: '1px solid #e0e7ff',
          }}>
            <ChatIcon sx={{ color: '#6366f1', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              Room Chat
            </Typography>
            {unreadCount > 0 && (
              <Chip label={unreadCount} size="small" color="error" sx={{ height: 18, fontSize: 10, ml: 'auto' }} />
            )}
          </Box>
          {chatSection}
        </Box>

        {/* Floating reactions */}
        {floatingReactions.map(r => (
          <FloatingReaction key={r.id} emoji={r.emoji} username={r.username} onDone={() => removeFloatingReaction(r.id)} />
        ))}

        {/* Virtual Background panel */}
        {showVBGPanel && (
          <VirtualBackgroundPanel
            currentBg={currentBg}
            onSetBackground={setBackground}
            isLoading={vbgLoading}
            error={vbgError}
            onClose={() => setShowVBGPanel(false)}
          />
        )}

        {/* Participants drawer */}
        <Drawer anchor="right" open={participantsDrawerOpen} onClose={() => setParticipantsDrawerOpen(false)}>
          <Box sx={{ width: 280 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="h6" fontWeight={700}>Participants</Typography>
              <IconButton onClick={() => setParticipantsDrawerOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Divider />
            {participantsPanel}
          </Box>
        </Drawer>

        <Snackbar
          open={snackbar.open} autoHideDuration={4000}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    );
  }


  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'background.default' }}>
      {/* Mobile header */}
      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ letterSpacing: '-0.3px', fontFamily: "'Outfit', sans-serif" }}>
            ConnectSphere
          </Typography>
          <Chip
            label={`#${roomId}`}
            size="small"
            sx={{ mr: 'auto', bgcolor: '#eef2ff', color: '#6366f1', fontWeight: 600, fontSize: 10, height: 20 }}
          />
          {isRecording && <Chip label="● REC" size="small" color="error" sx={{ mr: 1 }} />}
          {pttActive && <Chip label="🎤" size="small" color="success" sx={{ mr: 1 }} />}
          <IconButton size="small" color="inherit" onClick={copyRoomLink}><CopyIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="inherit" onClick={onLeave}><ExitIcon fontSize="small" /></IconButton>
        </Toolbar>
      </AppBar>

      {/* Floating reactions */}
      {floatingReactions.map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} username={r.username} onDone={() => removeFloatingReaction(r.id)} />
      ))}

      {/* Tab content */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {mobileTab === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ flex: 1, overflow: 'auto', background: '#0a0a0f' }}>
              {videoSection}
            </Box>
            {controlBar}
          </Box>
        )}
        {mobileTab === 1 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {chatSection}
          </Box>
        )}
        {mobileTab === 2 && (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {participantsPanel}
          </Box>
        )}

        {/* VBG panel as overlay on mobile */}
        {showVBGPanel && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 50,
            backgroundColor: 'background.default',
            display: 'flex', flexDirection: 'column',
          }}>
            <VirtualBackgroundPanel
              currentBg={currentBg}
              onSetBackground={setBackground}
              isLoading={vbgLoading}
              error={vbgError}
              onClose={() => setShowVBGPanel(false)}
            />
          </Box>
        )}
      </Box>

      {/* Mobile bottom nav */}
      <BottomNavigation
        value={mobileTab}
        onChange={(_, v) => { setMobileTab(v); if (v === 1) setUnreadCount(0); }}
        sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'background.paper' }}
      >
        <BottomNavigationAction label="Call" icon={<VideoIcon />} />
        <BottomNavigationAction
          label="Chat"
          icon={
            <Badge badgeContent={unreadCount} color="error">
              <ChatIcon />
            </Badge>
          }
        />
        <BottomNavigationAction
          label="People"
          icon={
            <Badge badgeContent={participants.length + 1} color="secondary">
              <PeopleIcon />
            </Badge>
          }
        />
      </BottomNavigation>

      <Snackbar
        open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: 60 }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Room;
