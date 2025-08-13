import React, { useState, useEffect, useRef, forwardRef } from 'react';
import {
  Box,
  Grid,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
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
  Alert
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
  Minimize as MinimizeIcon,
  Fullscreen as FullscreenIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  ExitToApp as ExitIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import socket from '../utils/socket';

// VideoPlayer Component
const VideoPlayer = forwardRef(({ 
  stream, 
  username, 
  isLocal = false, 
  isAudioEnabled = true, 
  isVideoEnabled = true,
  isScreenSharing = false,
  userId = null 
}, ref) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Forward ref to the video element
  useEffect(() => {
    if (ref && ref.current !== videoRef.current) {
      ref.current = videoRef.current;
    }
  }, [ref]);

  return (
    <Card sx={{ position: 'relative', height: '100%', minHeight: 200 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Only mute local video to prevent echo
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 8,
          backgroundColor: '#000'
        }}
      />
      
      {/* Video overlay with user info */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          right: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 1,
          p: 1
        }}
      >
        <Typography variant="caption" color="white" sx={{ fontWeight: 'bold' }}>
          {username}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isScreenSharing && (
            <Chip size="small" label="Sharing" color="warning" />
          )}
          {!isVideoEnabled && (
            <VideoOffIcon sx={{ color: 'red', fontSize: 16 }} />
          )}
          {!isAudioEnabled && (
            <MicOffIcon sx={{ color: 'red', fontSize: 16 }} />
          )}
        </Box>
      </Box>
      
      {/* Show avatar when video is off */}
      {!isVideoEnabled && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Avatar sx={{ width: 64, height: 64, fontSize: 24 }}>
            {username[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="body2" color="white">
            {username}
          </Typography>
        </Box>
      )}
    </Card>
  );
});

const Room = ({ username, roomId, onLeave }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Refs
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const messagesEndRef = useRef(null);

  // WebRTC configuration
  const pcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize room
  useEffect(() => {
    const initRoom = async () => {
      try {
        // Join the room
        socket.emit('join-room', roomId, username);
        console.log('Emitted join-room event:', roomId, username);
        
        // Reset states
        setLocalStream(null);
        setRemoteStreams(new Map());
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setIsInCall(false);
        
        // Clear video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        
      } catch (error) {
        console.error('Error initializing room:', error);
        showSnackbar('Failed to initialize room', 'error');
      }
    };

    initRoom();
    
    // Socket event listeners
    socket.on('room-data', (data) => {
      console.log('Received room data:', data);
      setParticipants(data.users || []);
      if (data.messages) {
        setMessages(data.messages);
      }
    });

    socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      setParticipants(prev => {
        // Avoid duplicates
        const exists = prev.some(p => p.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
      showSnackbar(`${data.username} joined the room`, 'success');
    });

    socket.on('user-left', (data) => {
      console.log('User left:', data);
      setParticipants(prev => prev.filter(p => p.id !== data.id));
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(data.id);
        return newStreams;
      });
      
      // Clean up peer connection
      const pc = peerConnections.current.get(data.id);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.id);
      }
      
      showSnackbar(`${data.username} left the room`, 'warning');
    });

    socket.on('receive-message', (data) => {
      console.log('Received message:', data);
      setMessages(prev => [...prev, data]);
    });

    // WebRTC signaling events
    socket.on('call-request', handleCallRequest);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-started-call', handleUserStartedCall);

    return () => {
      console.log('Cleaning up Room component...');
      
      // Remove socket listeners
      socket.off('room-data');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('receive-message');
      socket.off('call-request');
      socket.off('call-accepted');
      socket.off('call-declined');
      socket.off('call-ended');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-started-call');
      
      // Clean up media streams
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Clean up peer connections
      peerConnections.current.forEach(pc => {
        if (pc) {
          pc.close();
        }
      });
      peerConnections.current.clear();
    };
  }, [roomId, username]);

  // Auto scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Utility functions
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const copyRoomId = () => {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      showSnackbar('Room link copied to clipboard!', 'success');
    });
  };

  // Media functions
  const getUserMedia = async (video = true, audio = true) => {
    try {
      const constraints = {
        video: video ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Enable all tracks
      stream.getTracks().forEach(track => {
        track.enabled = true;
      });

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      let errorMessage = 'Error accessing camera/microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Please allow camera and microphone access';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found';
      }
      
      showSnackbar(errorMessage, 'error');
      throw error;
    }
  };

  // WebRTC helper functions
  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection(pcConfig);
    
    // Handle incoming streams
    pc.ontrack = (event) => {
      console.log('Received remote stream from:', userId);
      const [stream] = event.streams;
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.set(userId, stream);
        return newStreams;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', userId);
        socket.emit('ice-candidate', {
          target: userId,
          candidate: event.candidate,
          roomId
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.log('Connection failed, attempting to restart ICE');
        pc.restartIce();
      }
    };

    return pc;
  };

  // Call functions
  const startVideoCall = async () => {
    try {
      console.log('Starting video call...');
      
      // Clean up existing stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // Get new media stream
      const mediaStream = await getUserMedia(true, true);
      
      // Update state
      setLocalStream(mediaStream);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setIsInCall(true);

      // Set up local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        try {
          await localVideoRef.current.play();
        } catch (playError) {
          console.warn('Auto-play prevented, user interaction required');
        }
      }

      // Notify other participants
      socket.emit('start-call', { roomId, type: 'video', username });
      showSnackbar('Video call started', 'success');

    } catch (error) {
      console.error('Error starting video call:', error);
      
      // Clean up on error
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      setLocalStream(null);
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      setIsInCall(false);
      
      showSnackbar(
        error.name === 'NotAllowedError' 
          ? 'Please allow camera and microphone access' 
          : 'Failed to start video call',
        'error'
      );
    }
  };

  const startVoiceCall = async () => {
    try {
      console.log('Starting voice call...');
      
      // Clean up existing stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // Get audio-only stream
      const mediaStream = await getUserMedia(false, true);
      
      // Update state
      setLocalStream(mediaStream);
      setIsVideoEnabled(false);
      setIsAudioEnabled(true);
      setIsInCall(true);

      // Notify other participants
      socket.emit('start-call', { roomId, type: 'voice', username });
      showSnackbar('Voice call started', 'success');

    } catch (error) {
      console.error('Error starting voice call:', error);
      
      // Clean up on error
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsInCall(false);
      
      showSnackbar('Failed to start voice call', 'error');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        showSnackbar(videoTrack.enabled ? 'Video enabled' : 'Video disabled', 'info');
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        showSnackbar(audioTrack.enabled ? 'Microphone enabled' : 'Microphone disabled', 'info');
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track in existing peer connections
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Replace local video track
        if (localStream) {
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStream.addTrack(videoTrack);
        }

        setIsScreenSharing(true);
        showSnackbar('Screen sharing started', 'success');
        
        // Handle screen share end
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          showSnackbar('Screen sharing stopped', 'info');
          // Optionally restart camera
          restartCamera();
        };
        
      } else {
        // Stop screen sharing manually
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
          }
        }
        setIsScreenSharing(false);
        restartCamera();
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      showSnackbar('Screen sharing failed', 'error');
    }
  };

  const restartCamera = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      const videoTrack = videoStream.getVideoTracks()[0];
      
      // Replace track in peer connections
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Add to local stream
      if (localStream) {
        localStream.addTrack(videoTrack);
      }
      
      setIsVideoEnabled(true);
    } catch (error) {
      console.error('Error restarting camera:', error);
    }
  };

  const endCall = () => {
    try {
      console.log('Ending call...');
      
      // Stop all local tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Close all peer connections
      peerConnections.current.forEach(pc => {
        if (pc) {
          pc.close();
        }
      });
      peerConnections.current.clear();

      // Reset all states
      setLocalStream(null);
      setRemoteStreams(new Map());
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      setIsScreenSharing(false);
      setIsInCall(false);

      // Notify server
      socket.emit('end-call', { roomId, username });
      showSnackbar('Call ended', 'info');
      
    } catch (error) {
      console.error('Error ending call:', error);
      showSnackbar('Error ending call', 'error');
    }
  };

  // WebRTC event handlers
  const handleUserStartedCall = async (data) => {
    console.log('User started call:', data);
    
    if (!localStream || !isInCall) {
      console.log('Not in call, ignoring call start event');
      return;
    }

    // Create peer connection for the user who started the call
    const pc = createPeerConnection(data.userId);
    peerConnections.current.set(data.userId, pc);

    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('offer', {
        target: data.userId,
        offer: offer,
        roomId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleCallRequest = (data) => {
    showSnackbar(`${data.from} is calling...`, 'info');
  };

  const handleCallAccepted = (data) => {
    showSnackbar('Call accepted', 'success');
  };

  const handleCallDeclined = (data) => {
    showSnackbar('Call declined', 'warning');
  };

  const handleCallEnded = (data) => {
    console.log('Call ended by remote user:', data);
    
    // Remove the specific user's stream and connection
    if (data.userId) {
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(data.userId);
        return newStreams;
      });
      
      const pc = peerConnections.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.userId);
      }
    }
    
    showSnackbar(`Call ended by ${data.username || 'remote user'}`, 'info');
  };

  const handleOffer = async ({ sender, offer }) => {
    try {
      console.log('Received offer from:', sender);
      
      if (!localStream) {
        console.log('No local stream available for peer connection');
        return;
      }

      let pc = peerConnections.current.get(sender);
      if (!pc) {
        pc = createPeerConnection(sender);
        peerConnections.current.set(sender, pc);
      }
      
      // Add local stream
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      socket.emit('answer', {
        target: sender,
        answer: answer,
        roomId
      });
      
    } catch (error) {
      console.error('Error handling offer:', error);
      showSnackbar('Error establishing connection', 'error');
    }
  };

  const handleAnswer = async ({ sender, answer }) => {
    try {
      console.log('Received answer from:', sender);
      
      const pc = peerConnections.current.get(sender);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Answer processed successfully');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async ({ sender, candidate }) => {
    try {
      const pc = peerConnections.current.get(sender);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ICE candidate added for:', sender);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Message functions
  const sendMessage = () => {
    if (message.trim()) {
      const messageData = {
        roomId,
        username,
        message: message.trim(),
        timestamp: new Date().toISOString()
      };
      
      socket.emit('send-message', messageData);
      setMessage('');
    }
  };

  const handleMessageKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ConnectSphere - Room: {roomId}
          </Typography>
          <IconButton color="inherit" onClick={copyRoomId}>
            <CopyIcon />
          </IconButton>
          <IconButton 
            color="inherit" 
            onClick={() => setParticipantsDrawerOpen(true)}
          >
            <Badge badgeContent={participants.length} color="secondary">
              <PeopleIcon />
            </Badge>
          </IconButton>
          <IconButton color="inherit" onClick={onLeave}>
            <ExitIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, height: 'calc(100vh - 64px)', display: 'flex' }}>
        {/* Left Panel - Call Controls */}
        <Paper 
          sx={{ 
            width: isMobile ? '100%' : 300,
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            gap: 2
          }}
        >
          <Typography variant="h6" gutterBottom>
            Call Controls
          </Typography>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<VideoIcon />}
            onClick={startVideoCall}
            disabled={isInCall}
            fullWidth
          >
            Start Video Call
          </Button>
          
          <Button
            variant="contained"
            color="secondary"
            startIcon={<MicIcon />}
            onClick={startVoiceCall}
            disabled={isInCall}
            fullWidth
          >
            Start Voice Call
          </Button>

          {isInCall && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant={isVideoEnabled ? "contained" : "outlined"}
                color={isVideoEnabled ? "primary" : "default"}
                startIcon={isVideoEnabled ? <VideoIcon /> : <VideoOffIcon />}
                onClick={toggleVideo}
                fullWidth
                size="small"
              >
                {isVideoEnabled ? 'Video On' : 'Video Off'}
              </Button>
              
              <Button
                variant={isAudioEnabled ? "contained" : "outlined"}
                color={isAudioEnabled ? "primary" : "default"}
                startIcon={isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
                onClick={toggleAudio}
                fullWidth
                size="small"
              >
                {isAudioEnabled ? 'Mic On' : 'Mic Off'}
              </Button>
              
              <Button
                variant={isScreenSharing ? "contained" : "outlined"}
                startIcon={isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                onClick={toggleScreenShare}
                fullWidth
                size="small"
              >
                {isScreenSharing ? 'Stop Share' : 'Share Screen'}
              </Button>
              
              <Button
                variant="contained"
                color="error"
                startIcon={<CallEndIcon />}
                onClick={endCall}
                fullWidth
                size="small"
              >
                End Call
              </Button>
            </Box>
          )}

          <Divider />
          
          <Typography variant="subtitle2">
            Participants ({participants.length + 1})
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            <ListItem>
              <ListItemAvatar>
                <Avatar>{username[0]?.toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={`${username} (You)`}
                secondary={isInCall ? 'In call' : 'Online'}
              />
            </ListItem>
            {participants.map((participant) => (
              <ListItem key={participant.id}>
                <ListItemAvatar>
                  <Avatar>{participant.username[0]?.toUpperCase()}</Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={participant.username}
                  secondary="Online"
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Right Panel - Chat and Video */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Video Section */}
          {isInCall && (
            <Paper sx={{ 
              m: 1, 
              p: 1, 
              height: isMobile ? 200 : 300,
              display: 'flex',
              gap: 1,
              overflow: 'auto'
            }}>
              {/* Local Video */}
              <VideoPlayer
                ref={localVideoRef}
                stream={localStream}
                username={username + ' (You)'}
                isLocal={true}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                isScreenSharing={isScreenSharing}
              />
              
              {/* Remote Videos */}
              {Array.from(remoteStreams).map(([userId, stream]) => {
                const participant = participants.find(p => p.id === userId);
                return (
                  <VideoPlayer
                    key={userId}
                    stream={stream}
                    username={participant?.username || 'Unknown'}
                    isLocal={false}
                    isAudioEnabled={true}
                    isVideoEnabled={true}
                    userId={userId}
                  />
                );
              })}
            </Paper>
          )}

          {/* Chat Section */}
          <Paper sx={{ 
            m: 1, 
            flexGrow: 1,
            display: 'flex', 
            flexDirection: 'column'
          }}>
            {/* Chat Header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">
                <ChatIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Chat Messages
              </Typography>
            </Box>

            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
              {messages.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%',
                  color: 'text.secondary' 
                }}>
                  <Typography>No messages yet. Start the conversation!</Typography>
                </Box>
              ) : (
                messages.map((msg, index) => (
                  <Card 
                    key={index} 
                    variant="outlined" 
                    sx={{ 
                      mb: 1, 
                      maxWidth: '80%', 
                      ml: msg.username === username ? 'auto' : 0,
                      bgcolor: msg.username === username ? 'primary.light' : 'background.paper'
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="primary" fontWeight="bold">
                        {msg.username}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, mb: 0.5 }}>
                        {msg.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleMessageKeyPress}
                InputProps={{
                  endAdornment: (
                    <IconButton 
                      color="primary" 
                      onClick={sendMessage}
                      disabled={!message.trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  ),
                }}
              />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Participants Drawer */}
      <Drawer
        anchor="right"
        open={participantsDrawerOpen}
        onClose={() => setParticipantsDrawerOpen(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Participants ({participants.length + 1})
          </Typography>
          <List>
            <ListItem>
              <ListItemAvatar>
                <Avatar>{username[0]?.toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={`${username} (You)`}
                secondary={
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    {isInCall && <Chip size="small" label="In Call" color="primary" />}
                    {isVideoEnabled && <Chip size="small" label="Video" color="success" />}
                    {isAudioEnabled && <Chip size="small" label="Audio" color="success" />}
                  </Box>
                }
              />
            </ListItem>
            {participants.map((participant) => (
              <ListItem key={participant.id}>
                <ListItemAvatar>
                  <Avatar>{participant.username[0]?.toUpperCase()}</Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={participant.username}
                  secondary={<Chip size="small" label="Online" color="success" />}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Room;