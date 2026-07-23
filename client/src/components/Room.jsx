import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Tooltip,
  Fab,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  Videocam as VideoIcon,
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
  VideocamOff as VideoOffIcon,
} from '@mui/icons-material';
import socket from '../utils/socket';
import { CONFIG } from '../config';
import { sounds } from '../hooks/useSound';
import { useVirtualBackground } from '../hooks/useVirtualBackground';
import VirtualBackgroundPanel from './VirtualBackgroundPanel';
import { deriveKeyFromPassword, importEncryptionKey } from '../utils/crypto';
import { getAvatarColor, getInitials } from '../utils/avatarColor';
import VideoPlayer from './VideoPlayer';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRoomChat } from '../hooks/useRoomChat';

// pcConfig is now internal to useWebRTC hook

// ─── Emoji Reactions ────────────────────────────────────────────────────────
const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

// ─── Main Room Component ─────────────────────────────────────────────────────
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
  // (WebRTC, streams and chat state are managed by useWebRTC / useRoomChat hooks)
  const [participants, setParticipants]                 = useState([]);
  const [mobileTab, setMobileTab]                       = useState(0); // 0=video 1=chat 2=people
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [snackbar, setSnackbar]                         = useState({ open: false, message: '', severity: 'info' });
  const [chatFocused, setChatFocused]                   = useState(false);
  // Raise hand
  const [handRaised, setHandRaised]   = useState(false);
  const [raisedHands, setRaisedHands] = useState(new Map()); // userId -> username
  // Reactions picker
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Virtual background
  const [showVBGPanel, setShowVBGPanel] = useState(false);
  // Pinned remote speaker (null if grid view)
  const [pinnedUserId, setPinnedUserId] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null); // chat auto-scroll

  // E2EE Crypto Key Promise (stable across renders)
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

  const showSnackbar = useCallback((msg, severity = 'info') => {
    setSnackbar({ open: true, message: msg, severity });
  }, []);

  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    sounds[type]?.();
  }, [soundEnabled]);

  // ── useWebRTC ─────────────────────────────────────────────────────────────
  const {
    localStream, localStreamRef, localVideoRef,
    remoteStreams,
    isInCall, isVideoEnabled, isAudioEnabled,
    isScreenSharing, isRecording,
    isPushToTalk, pttActive,
    peerConnections,
    startCall, endCall,
    toggleVideo, toggleAudio, toggleScreenShare,
    startRecording, stopRecording,
    startSpeaking, stopSpeaking, togglePushToTalk,
    replaceVideoTracks,
  } = useWebRTC({ roomId, username, password, startWithVideo, startWithAudio, showSnackbar, playSound });

  // ── isChatVisible — defined before useRoomChat so the hook receives it ────
  const isChatVisible = isMobile ? mobileTab === 1 : true;

  const {
    messages, message, setMessage,
    unreadCount, setUnreadCount,
    sendMessage,
    floatingReactions, sendReaction, removeFloatingReaction,
    mergeServerMessages,
  } = useRoomChat({ roomId, username, cryptoKeyPromiseRef, isChatVisible, playSound });

  const copyRoomLink = useCallback(() => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}${e2eKey ? `#key=${e2eKey}` : ''}`;
    navigator.clipboard.writeText(link)
      .then(() => showSnackbar('Room link copied!', 'success'));
  }, [roomId, e2eKey, showSnackbar]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // Virtual background — processes rawStream → processedStream via TF.js
  const {
    processedStream,
    isLoading: vbgLoading,
    error: vbgError,
    currentBg,
    setBackground,
  } = useVirtualBackground(localStream);

  // When VBG processedStream changes, hand updated tracks to WebRTC peers
  useEffect(() => {
    const activeStream = processedStream || localStream;
    if (!activeStream) return;
    replaceVideoTracks(activeStream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = activeStream;
    }
  }, [processedStream, localStream, replaceVideoTracks, localVideoRef]);

  // ── Stable refs for values used inside socket closures ───────────────────
  const showSnackbarRef = useRef(showSnackbar);
  useEffect(() => { showSnackbarRef.current = showSnackbar; }, [showSnackbar]);

  const playSoundRef = useRef(playSound);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

  // ── PTT / audio / media all handled by useWebRTC hook ────────────────────

  // ── Main socket listeners (room join, participants, signaling refs) ────────
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
        mergeServerMessages(decryptedMessages);
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
      // Note: remoteStreams + peerConnections are cleaned up by useWebRTC's own listener
      showSnackbarRef.current(`${data.username} left`, 'warning');
      playSoundRef.current('userLeft');
    };

    const onJoinError = (msg) => {
      showSnackbarRef.current(msg, 'error');
      onLeave();
    };

    socket.on('room-data',   onRoomData);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left',   onUserLeft);
    socket.on('join-error',  onJoinError);

    return () => {
      socket.off('room-data',   onRoomData);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left',   onUserLeft);
      socket.off('join-error',  onJoinError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username]);

  // ── Raise hand — uses showSnackbarRef so it doesn't need re-registration ──
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
  }, []);

  // ── Raise hand action ─────────────────────────────────────────────────────
  const toggleRaiseHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    socket.emit('raise-hand', { roomId, username, raised: next });
  };

  // getAvatarColor and getInitials are now imported from utils/avatarColor.js

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

  // Dynamic remote streams layout generator (Grid vs Pinned)
  // Memoized: only re-runs when streams, participants, pins, or raised hands change
  const renderRemoteVideos = React.useMemo(() => {
    const list = Array.from(remoteStreams);
    if (list.length === 0) {
      return (
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3, borderRadius: '20px',
          border: '2px dashed rgba(99,102,241,0.2)',
          background: 'rgba(255,255,255,0.02)',
          height: '100%',
          p: 3,
          textAlign: 'center',
        }}>
          <Box sx={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(99,102,241,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99,102,241,0.05)',
          }}>
            <VideoIcon sx={{ fontSize: 36, color: '#818cf8' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ mb: 1, fontFamily: "'Outfit', sans-serif" }}>
              Waiting for others to join
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mx: 'auto' }}>
              Invite people to this room by sharing the link in your browser URL.
            </Typography>
          </Box>
        </Box>
      );
    }

    // Pinned View
    if (pinnedUserId && remoteStreams.has(pinnedUserId)) {
      const pinnedStream = remoteStreams.get(pinnedUserId);
      const pinnedUser = participants.find(x => x.id === pinnedUserId);
      const otherRemotes = list.filter(([uid]) => uid !== pinnedUserId);

      return (
        <Box sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          width: '100%',
          height: '100%',
          gap: 2,
          p: 1,
        }}>
          {/* Pinned stream (large) */}
          <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <VideoPlayer
              stream={pinnedStream}
              username={pinnedUser?.username || 'Unknown'}
              isLocal={false}
              avatarColor={getAvatarColor(pinnedUser?.username)}
              handRaised={raisedHands.has(pinnedUserId)}
              userId={pinnedUserId}
              roomId={roomId}
              variant="large"
              isPinned={true}
              onPin={() => setPinnedUserId(null)}
            />
          </Box>

          {/* Thumbnail list for remaining remote participants */}
          {otherRemotes.length > 0 && (
            <Box sx={{
              width: isMobile ? '100%' : 140,
              height: isMobile ? 100 : '100%',
              flexShrink: 0,
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              gap: 1.5,
              overflowX: isMobile ? 'auto' : 'hidden',
              overflowY: isMobile ? 'hidden' : 'auto',
              p: 0.5,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '16px',
            }}>
              {otherRemotes.map(([uid, stream]) => {
                const p = participants.find(x => x.id === uid);
                return (
                  <Box key={uid} sx={{ width: isMobile ? 120 : '100%', height: isMobile ? '100%' : 100, flexShrink: 0 }}>
                    <VideoPlayer
                      stream={stream}
                      username={p?.username || 'Unknown'}
                      isLocal={false}
                      avatarColor={getAvatarColor(p?.username)}
                      handRaised={raisedHands.has(uid)}
                      userId={uid}
                      roomId={roomId}
                      variant="thumb"
                      isPinned={false}
                      onPin={() => setPinnedUserId(uid)}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      );
    }

    // Grid View
    const count = list.length;
    let gridCols = 1;
    if (count === 2) gridCols = 2;
    else if (count >= 3 && count <= 4) gridCols = 2;
    else if (count >= 5) gridCols = 3;

    return (
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(${gridCols}, 1fr)`
        },
        gap: 2,
        p: 1,
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        alignContent: 'center',
      }}>
        {list.map(([uid, stream]) => {
          const p = participants.find(x => x.id === uid);
          return (
            <Box key={uid} sx={{ aspectRatio: '16/9', width: '100%', position: 'relative' }}>
              <VideoPlayer
                stream={stream}
                username={p?.username || 'Unknown'}
                isLocal={false}
                avatarColor={getAvatarColor(p?.username)}
                handRaised={raisedHands.has(uid)}
                userId={uid}
                roomId={roomId}
                variant="large"
                isPinned={false}
                onPin={() => setPinnedUserId(uid)}
              />
            </Box>
          );
        })}
      </Box>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams, participants, raisedHands, pinnedUserId, isMobile, roomId]);

  // Video section (renders the remote video layout + local PIP)
  const videoSection = (
    <Box sx={{
      width: '100%',
      height: '100%',
      position: 'relative',
      flex: 1,
      minHeight: isMobile ? 240 : 0,
      background: 'radial-gradient(ellipse at 10% 10%, rgba(88,101,242,0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 90%, rgba(235,69,158,0.05) 0%, transparent 50%), #0a0a0f',
      overflow: 'hidden',
    }}>
      {renderRemoteVideos}

      {/* Floating Picture-in-Picture Local Video */}
      {isInCall && (
        <Box sx={{
          position: 'absolute',
          bottom: { xs: 16, md: 24 },
          right: { xs: 16, md: 24 },
          width: { xs: 120, sm: 160, md: 200 },
          aspectRatio: '16/9',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.1) inset, 0 0 20px rgba(99,102,241,0.3)',
          border: '2px solid rgba(255,255,255,0.2)',
          zIndex: 10,
          background: '#000',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.2) inset, 0 0 30px rgba(99,102,241,0.5)',
            border: '2px solid rgba(99,102,241,0.5)',
          }
        }}>
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
            variant="large"
          />
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

          {/* Main video workspace area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, position: 'relative' }}>
            <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative', borderRadius: '20px' }}>
              {videoSection}
            </Box>

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
