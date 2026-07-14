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
import { sounds } from '../hooks/useSound';
import { useChatPersistence } from '../hooks/useChatPersistence';
import { useVirtualBackground } from '../hooks/useVirtualBackground';
import VirtualBackgroundPanel from './VirtualBackgroundPanel';

// ─── Emoji Reactions ────────────────────────────────────────────────────────
const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

// ─── Inline VideoPlayer ──────────────────────────────────────────────────────
const VideoPlayer = forwardRef(({
  stream, username, isLocal = false,
  isAudioEnabled = true, isVideoEnabled = true,
  isScreenSharing = false, avatarColor = '#5865f2',
  handRaised = false,
}, ref) => {
  const videoRef = useRef(null);
  const resolvedRef = ref || videoRef;

  useEffect(() => {
    const el = resolvedRef.current;
    if (el && stream) {
      el.srcObject = stream;
    }
  }, [stream, resolvedRef]);

  const initials = username?.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';

  return (
    <Card
      className={isLocal ? 'local-video-mirror' : undefined}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 180,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        border: isLocal ? '2px solid' : '1px solid',
        borderColor: isLocal ? 'primary.main' : 'divider',
        flexShrink: 0,
        flex: '1 1 280px',
        maxWidth: '100%',
      }}
    >
      {isLocal && (
        <style>{`.local-video-mirror video { transform: scaleX(-1); }`}</style>
      )}
      <video
        ref={resolvedRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          display: isVideoEnabled && stream ? 'block' : 'none',
        }}
      />
      {(!isVideoEnabled || !stream) && (
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.85)',
        }}>
          <Avatar sx={{ width: 64, height: 64, fontSize: 24, backgroundColor: avatarColor, mb: 1 }}>
            {initials}
          </Avatar>
          <Typography variant="caption" color="white">{username}</Typography>
        </Box>
      )}
      {/* Overlay bar */}
      <Box sx={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        bgcolor: 'rgba(0,0,0,0.6)', px: 1, py: 0.5,
      }}>
        <Typography variant="caption" color="white" fontWeight={600} noWrap sx={{ maxWidth: 120 }}>
          {username}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {handRaised && <span style={{ fontSize: 14 }}>✋</span>}
          {isScreenSharing && <ScreenShareIcon sx={{ color: 'warning.main', fontSize: 14 }} />}
          {!isVideoEnabled && <VideoOffIcon sx={{ color: 'error.main', fontSize: 14 }} />}
          {!isAudioEnabled && <MicOffIcon sx={{ color: 'error.main', fontSize: 14 }} />}
        </Box>
      </Box>
    </Card>
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
const Room = ({ username, roomId, password, maxParticipants = 8, avatarColor = '#5865f2', startWithVideo = true, startWithAudio = true, onLeave }) => {
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

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const messagesEndRef = useRef(null);
  const localStreamRef = useRef(null); // stable ref for closures

  const { loadMessages, saveMessages } = useChatPersistence(roomId);

  // Virtual background — processes rawStream → processedStream via TF.js
  const {
    processedStream,
    isLoading: vbgLoading,
    error: vbgError,
    currentBg,
    setBackground,
  } = useVirtualBackground(localStream);

  // When processedStream changes, update localStreamRef so WebRTC uses it
  useEffect(() => {
    if (!processedStream) return;
    localStreamRef.current = processedStream;
    // Replace tracks in all active peer connections
    peerConnections.current.forEach(pc => {
      processedStream.getVideoTracks().forEach(newTrack => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
    });
    // Update local video preview
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = processedStream;
    }
  }, [processedStream]);

  const pcConfig = {
    iceServers: [
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
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(link)
      .then(() => showSnackbar('Room link copied!', 'success'));
  }, [roomId, showSnackbar]);

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
  useEffect(() => {
    if (!isPushToTalk) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          setIsAudioEnabled(true);
          setPttActive(true);
        }
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space' && localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setIsAudioEnabled(false);
          setPttActive(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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

    const onRoomData = (data) => {
      const otherUsers = (data.users || []).filter(u => u.id !== socket.id);
      setParticipants(otherUsers);
      if (data.messages?.length) {
        setMessages(prev => {
          // Merge server messages with local cache, deduplicate by id
          const ids = new Set(prev.map(m => m.id));
          const merged = [...prev];
          data.messages.forEach(m => { if (!ids.has(m.id)) merged.push(m); });
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

    const onUserLeft = (data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.id));
      setRemoteStreams(prev => { const m = new Map(prev); m.delete(data.id); return m; });
      setRaisedHands(prev => { const m = new Map(prev); m.delete(data.id); return m; });
      const pc = peerConnections.current.get(data.id);
      if (pc) { pc.close(); peerConnections.current.delete(data.id); }
      showSnackbarRef.current(`${data.username} left`, 'warning');
      playSoundRef.current('userLeft');
    };

    const onReceiveMessage = (data) => {
      setMessages(prev => [...prev, data]);
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
      const pc = createPeerConnection(data.userId);
      peerConnections.current.set(data.userId, pc);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { target: data.userId, offer, roomId });
    };

    const onOffer = async ({ sender, offer }) => {
      const stream = localStreamRef.current;
      if (!stream) return;
      let pc = peerConnections.current.get(sender);
      if (!pc) { pc = createPeerConnection(sender); peerConnections.current.set(sender, pc); }
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: sender, answer, roomId });
    };

    const onAnswer = async ({ sender, answer }) => {
      const pc = peerConnections.current.get(sender);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const onIceCandidate = async ({ sender, candidate }) => {
      const pc = peerConnections.current.get(sender);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
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

  // ── Push-to-talk toggle ────────────────────────────────────────────────────
  const togglePushToTalk = () => {
    const next = !isPushToTalk;
    setIsPushToTalk(next);
    if (next && localStreamRef.current) {
      // Mute mic initially when PTT turns on
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = false; setIsAudioEnabled(false); }
    }
    showSnackbar(next ? 'Push-to-talk ON (hold Space to speak)' : 'Push-to-talk OFF', 'info');
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit('send-message', {
      roomId, username,
      message: message.trim(),
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
      justifyContent: 'center', alignItems: 'center', p: 1.5,
      backgroundColor: 'rgba(32,34,37,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
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
              onClick={toggleAudio}
              sx={{
                backgroundColor: isPushToTalk
                  ? (pttActive ? 'success.main' : 'warning.main')
                  : (isAudioEnabled ? 'success.main' : 'error.main'),
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
              sx={{
                backgroundColor: isVideoEnabled ? 'success.main' : 'error.main',
                color: 'white', '&:hover': { backgroundColor: 'inherit' },
              }}
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <VideoIcon /> : <VideoOffIcon />}
            </Fab>
          </Tooltip>

          {/* Screen share */}
          <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            <Fab size="small"
              sx={{
                backgroundColor: isScreenSharing ? 'primary.main' : 'background.paper',
                color: isScreenSharing ? 'white' : 'text.primary',
                border: isScreenSharing ? 'none' : '1px solid',
                borderColor: 'primary.main',
                '&:hover': { backgroundColor: 'primary.dark', color: 'white' },
              }}
              onClick={toggleScreenShare}
            >
              {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </Fab>
          </Tooltip>

          {/* Record */}
          <Tooltip title={isRecording ? 'Stop recording' : 'Start recording'}>
            <Fab size="small"
              sx={{
                backgroundColor: isRecording ? 'error.main' : 'background.paper',
                color: isRecording ? 'white' : 'error.main',
                border: isRecording ? 'none' : '1px solid',
                borderColor: 'error.main',
                animation: isRecording ? 'pulse 1.2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
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
      display: 'flex', gap: 1, p: 1,
      overflowX: 'auto',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      flex: 1,
      minHeight: isMobile ? 200 : 0,
      backgroundColor: '#111',
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
        flex: 1, overflow: 'auto', p: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 2 },
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
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'background.default' }}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Toolbar variant="dense">
            <VideoCallIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              ConnectSphere
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                #{roomId}
              </Typography>
            </Typography>
            {isRecording && (
              <Chip label="● REC" size="small" color="error" sx={{ mr: 1, animation: 'pulse 1.2s infinite' }} />
            )}
            {pttActive && <Chip label="🎤 Speaking" size="small" color="success" sx={{ mr: 1 }} />}
            <IconButton size="small" color="inherit" onClick={copyRoomLink}><CopyIcon /></IconButton>
            <IconButton size="small" color="inherit" onClick={() => setParticipantsDrawerOpen(true)}>
              <Badge badgeContent={participants.length + 1} color="secondary"><PeopleIcon /></Badge>
            </IconButton>
            <IconButton size="small" color="inherit" onClick={onLeave}><ExitIcon /></IconButton>
          </Toolbar>
        </AppBar>

        {/* Floating reactions */}
        {floatingReactions.map(r => (
          <FloatingReaction key={r.id} emoji={r.emoji} username={r.username} onDone={() => removeFloatingReaction(r.id)} />
        ))}

        {/* Main area */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Video + controls column */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <Box sx={{ flex: 1, display: 'flex', overflow: 'auto', backgroundColor: '#111' }}>
              {videoSection}
            </Box>
            {controlBar}
          </Box>

          {/* Chat sidebar */}
          <Paper sx={{
            width: 320,
            display: 'flex', flexDirection: 'column',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0,
          }}>
            {chatSection}
          </Paper>

          {/* Virtual Background panel — slides in from right */}
          {showVBGPanel && (
            <VirtualBackgroundPanel
              currentBg={currentBg}
              onSetBackground={setBackground}
              isLoading={vbgLoading}
              error={vbgError}
              onClose={() => setShowVBGPanel(false)}
            />
          )}
        </Box>

        {/* Participants drawer */}
        <Drawer anchor="right" open={participantsDrawerOpen} onClose={() => setParticipantsDrawerOpen(false)}>
          <Box sx={{ width: 280 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
              <Typography variant="h6">Participants</Typography>
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
        <Toolbar variant="dense">
          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>#{roomId}</Typography>
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
            <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#111' }}>
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
