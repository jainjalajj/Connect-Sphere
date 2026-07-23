/**
 * useWebRTC — manages all peer-to-peer WebRTC logic for a room.
 *
 * Extracted from Room.jsx to keep the component focused on UI layout.
 * Handles: peer connections, ICE candidates, media controls,
 *          screen share, recording, and push-to-talk.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../utils/socket';
import { CONFIG } from '../config';

// Hoisted at module level — never recreated across renders
const PC_CONFIG = {
  iceServers: CONFIG.ICE_SERVERS || [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * @param {object} opts
 * @param {string}   opts.roomId
 * @param {string}   opts.username
 * @param {string}   [opts.password]
 * @param {boolean}  opts.startWithVideo
 * @param {boolean}  opts.startWithAudio
 * @param {Function} opts.showSnackbar  – (msg, severity) => void
 * @param {Function} opts.playSound     – (type) => void
 */
export function useWebRTC({
  roomId,
  username,
  password,
  startWithVideo,
  startWithAudio,
  showSnackbar,
  playSound,
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [localStream, setLocalStream]       = useState(null);
  const [remoteStreams, setRemoteStreams]    = useState(new Map());
  const [isInCall, setIsInCall]             = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [isPushToTalk, setIsPushToTalk]     = useState(false);
  const [pttActive, setPttActive]           = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localVideoRef        = useRef(null);
  const localStreamRef       = useRef(null);
  const peerConnections      = useRef(new Map());
  const pendingIceCandidates = useRef(new Map());
  const mediaRecorderRef     = useRef(null);
  const recordedChunksRef    = useRef([]);

  // Stable refs so socket closures always see fresh values
  const isInCallRef      = useRef(false);
  const showSnackbarRef  = useRef(showSnackbar);
  const playSoundRef     = useRef(playSound);
  useEffect(() => { isInCallRef.current     = isInCall;    }, [isInCall]);
  useEffect(() => { showSnackbarRef.current = showSnackbar; }, [showSnackbar]);
  useEffect(() => { playSoundRef.current    = playSound;    }, [playSound]);

  // ── Media helpers ──────────────────────────────────────────────────────────
  const getUserMedia = useCallback(async (video = true, audio = true) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
      audio: audio
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : false,
    });
    stream.getTracks().forEach(t => { t.enabled = true; });
    return stream;
  }, []);

  // ── Peer connection factory ────────────────────────────────────────────────
  const createPeerConnection = useCallback((userId) => {
    const pc = new RTCPeerConnection(PC_CONFIG);

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
  }, [roomId]);

  // ── ICE candidate queue helpers ────────────────────────────────────────────
  const processQueuedCandidates = useCallback(async (userId, pc) => {
    const candidates = pendingIceCandidates.current.get(userId) || [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
    pendingIceCandidates.current.delete(userId);
  }, []);

  // ── Socket handlers (registered once per roomId) ──────────────────────────
  useEffect(() => {
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
      showSnackbarRef.current(`Call ended by ${data.username || 'remote user'}`, 'info');
    };

    // Remove remote stream + peer connection when a user leaves
    const onUserLeft = (data) => {
      setRemoteStreams(prev => { const m = new Map(prev); m.delete(data.id); return m; });
      pendingIceCandidates.current.delete(data.id);
      const pc = peerConnections.current.get(data.id);
      if (pc) { pc.close(); peerConnections.current.delete(data.id); }
    };

    socket.on('user-started-call', onUserStartedCall);
    socket.on('offer',             onOffer);
    socket.on('answer',            onAnswer);
    socket.on('ice-candidate',     onIceCandidate);
    socket.on('call-ended',        onCallEnded);
    socket.on('user-left',         onUserLeft);

    return () => {
      socket.off('user-started-call', onUserStartedCall);
      socket.off('offer',             onOffer);
      socket.off('answer',            onAnswer);
      socket.off('ice-candidate',     onIceCandidate);
      socket.off('call-ended',        onCallEnded);
      socket.off('user-left',         onUserLeft);
    };
  }, [roomId, createPeerConnection, processQueuedCandidates]);

  // ── Call control ───────────────────────────────────────────────────────────
  const startCall = useCallback(async (withVideo) => {
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
      showSnackbarRef.current(withVideo ? 'Video call started' : 'Voice call started', 'success');
    } catch (err) {
      showSnackbarRef.current(
        err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : 'Failed to start call',
        'error'
      );
      setIsInCall(false);
    }
  }, [roomId, username, getUserMedia]);

  const endCall = useCallback(() => {
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
    showSnackbarRef.current('Call ended', 'info');
  }, [roomId, username]);

  // Auto-start on mount
  useEffect(() => {
    if (startWithVideo || startWithAudio) {
      startCall(startWithVideo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      pendingIceCandidates.current.clear();
    };
  }, []);

  // ── Track toggles ──────────────────────────────────────────────────────────
  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoEnabled(track.enabled); }
  }, []);

  const toggleAudio = useCallback(() => {
    if (isPushToTalk) return; // PTT controls audio
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsAudioEnabled(track.enabled); }
  }, [isPushToTalk]);

  // ── Screen sharing ─────────────────────────────────────────────────────────
  const restartCamera = useCallback(async () => {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const videoTrack = vs.getVideoTracks()[0];
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
      localStreamRef.current?.addTrack(videoTrack);
      setLocalStream(new MediaStream(localStreamRef.current?.getTracks() || []));
      setIsVideoEnabled(true);
    } catch (e) { /* camera unavailable */ }
  }, []);

  const toggleScreenShare = useCallback(async () => {
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
        videoTrack.onended = () => { setIsScreenSharing(false); restartCamera(); };
      } else {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.stop(); localStreamRef.current.removeTrack(track); }
        setIsScreenSharing(false);
        restartCamera();
      }
    } catch (err) {
      showSnackbarRef.current('Screen sharing failed', 'error');
    }
  }, [isScreenSharing, restartCamera]);

  // Called from VBG hook when processedStream changes
  const replaceVideoTracks = useCallback((activeStream) => {
    if (!activeStream) return;
    peerConnections.current.forEach(pc => {
      activeStream.getVideoTracks().forEach(newTrack => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
    });
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) { showSnackbarRef.current('Start a call before recording', 'warning'); return; }
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
        showSnackbarRef.current('Recording saved', 'success');
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      showSnackbarRef.current('Recording started', 'info');
    } catch {
      showSnackbarRef.current('Recording not supported in this browser', 'error');
    }
  }, [roomId]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  // ── Push-to-talk ───────────────────────────────────────────────────────────
  const startSpeaking = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = true; setPttActive(true); }
  }, []);

  const stopSpeaking = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = false; setPttActive(false); }
  }, []);

  // Spacebar hotkey for PTT
  useEffect(() => {
    if (!isPushToTalk) return;
    const handleKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
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
    window.addEventListener('keyup',   handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
    };
  }, [isPushToTalk, startSpeaking, stopSpeaking]);

  const togglePushToTalk = useCallback(() => {
    const next = !isPushToTalk;
    setIsPushToTalk(next);
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (next) {
      if (track) { track.enabled = false; setIsAudioEnabled(false); }
      showSnackbarRef.current('Push-to-talk ON — hold Space or the button to speak', 'info');
    } else {
      setPttActive(false);
      if (track) { track.enabled = true; setIsAudioEnabled(true); }
      showSnackbarRef.current('Push-to-talk OFF — mic is live', 'info');
    }
  }, [isPushToTalk]);

  return {
    // State
    localStream, localStreamRef, localVideoRef,
    remoteStreams,
    isInCall, isVideoEnabled, isAudioEnabled,
    isScreenSharing, isRecording,
    isPushToTalk, pttActive,
    peerConnections,
    // Actions
    startCall, endCall,
    toggleVideo, toggleAudio, toggleScreenShare,
    startRecording, stopRecording,
    startSpeaking, stopSpeaking, togglePushToTalk,
    replaceVideoTracks,
  };
}
