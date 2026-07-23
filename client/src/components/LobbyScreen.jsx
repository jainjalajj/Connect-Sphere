/**
 * LobbyScreen — pre-join media preview
 *
 * Shows a camera preview + audio level indicator before the user enters the room.
 * Lets the user toggle camera and microphone on/off before joining.
 * Passes { startWithVideo, startWithAudio } back to App via onJoin().
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Avatar,
  Card,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideoIcon,
  VideocamOff as VideoOffIcon,
  ArrowForward as EnterIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';

function LobbyScreen({ username, roomId, avatarColor, onJoin, onBack }) {
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [micError, setMicError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const videoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  const initials = username?.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';

  // Acquire media on mount and whenever toggles change
  useEffect(() => {
    let cancelled = false;

    const acquire = async () => {
      // Stop previous stream
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);

      setCameraError(null);
      setMicError(null);

      let newStream = null;

      // Try to get requested tracks
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: cameraOn ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
          audio: micOn ? { echoCancellation: true, noiseSuppression: true } : false,
        });
      } catch (err) {
        // If both fail, try audio only, then video only, then neither
        if (cameraOn && micOn) {
          try { newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); setCameraError(null); setMicError('Mic unavailable'); }
          catch { try { newStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); setMicError(null); setCameraError('Camera unavailable'); } catch { setCameraError('Camera unavailable'); setMicError('Mic unavailable'); } }
        } else if (cameraOn) {
          setCameraError('Camera unavailable');
        } else if (micOn) {
          setMicError('Mic unavailable');
        }
      }

      if (cancelled) { newStream?.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = newStream;
      setStream(newStream);

      // Attach to video element
      if (videoRef.current && newStream) {
        videoRef.current.srcObject = newStream;
      }

      // Audio level meter
      if (newStream?.getAudioTracks().length > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const source = ctx.createMediaStreamSource(newStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;

          const tick = () => {
            if (!analyserRef.current) return;
            const buf = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            setAudioLevel(Math.min(100, avg * 2));
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* audio meter optional */ }
      } else {
        setAudioLevel(0);
      }
    };

    acquire();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraOn, micOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleJoin = () => {
    // Stop the preview stream — Room will acquire its own
    streamRef.current?.getTracks().forEach(t => t.stop());
    onJoin({
      startWithVideo: cameraOn && !cameraError,
      startWithAudio: micOn && !micError,
    });
  };

  const hasVideo = stream?.getVideoTracks().length > 0 && cameraOn;

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eef2ff 0%, #f8f9ff 50%, #fdf4ff 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: 2,
    }}>
      <Card elevation={4} sx={{
        width: '100%', maxWidth: 520,
        backgroundColor: '#ffffff',
        border: '1px solid #e0e7ff',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(99,102,241,0.12)',
      }}>
        {/* Camera preview */}
        <Box sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: '#0a0a0f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '0',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              display: hasVideo ? 'block' : 'none',
            }}
          />
          {!hasVideo && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{
                width: 80, height: 80, fontSize: 32, fontWeight: 700,
                backgroundColor: avatarColor,
              }}>
                {initials}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {cameraError || 'Camera is off'}
              </Typography>
            </Box>
          )}

          {/* Room ID badge */}
          <Chip
            label={`Room: ${roomId}`}
            size="small"
            sx={{
              position: 'absolute', top: 12, left: 12,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white', fontWeight: 600,
              backdropFilter: 'blur(4px)',
            }}
          />
        </Box>

        {/* Controls */}
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom color="text.primary"
            sx={{ fontFamily: "'Outfit', sans-serif" }}>
            Ready to join, {username}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set up your camera and microphone before entering.
          </Typography>

          {/* Camera & mic toggles */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {/* Camera */}
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 1,
              p: 2, borderRadius: 2, cursor: 'pointer',
              border: '1px solid',
              borderColor: cameraOn && !cameraError ? 'success.main' : 'error.main',
              backgroundColor: cameraOn && !cameraError
                ? 'rgba(87,242,135,0.08)' : 'rgba(237,66,69,0.08)',
              transition: 'all 0.2s',
              '&:hover': { opacity: 0.85 },
            }}
              onClick={() => setCameraOn(p => !p)}
            >
              {cameraOn && !cameraError
                ? <VideoIcon sx={{ fontSize: 32, color: 'success.main' }} />
                : <VideoOffIcon sx={{ fontSize: 32, color: 'error.main' }} />
              }
              <Typography variant="caption" fontWeight={600}
                color={cameraOn && !cameraError ? 'success.main' : 'error.main'}>
                {cameraOn && !cameraError ? 'Camera On' : 'Camera Off'}
              </Typography>
              {cameraError && (
                <Typography variant="caption" color="error.light" textAlign="center">
                  {cameraError}
                </Typography>
              )}
            </Box>

            {/* Microphone */}
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 1,
              p: 2, borderRadius: 2, cursor: 'pointer',
              border: '1px solid',
              borderColor: micOn && !micError ? 'success.main' : 'error.main',
              backgroundColor: micOn && !micError
                ? 'rgba(87,242,135,0.08)' : 'rgba(237,66,69,0.08)',
              transition: 'all 0.2s',
              '&:hover': { opacity: 0.85 },
            }}
              onClick={() => setMicOn(p => !p)}
            >
              {micOn && !micError
                ? <MicIcon sx={{ fontSize: 32, color: 'success.main' }} />
                : <MicOffIcon sx={{ fontSize: 32, color: 'error.main' }} />
              }
              <Typography variant="caption" fontWeight={600}
                color={micOn && !micError ? 'success.main' : 'error.main'}>
                {micOn && !micError ? 'Mic On' : 'Mic Off'}
              </Typography>
              {micError && (
                <Typography variant="caption" color="error.light" textAlign="center">
                  {micError}
                </Typography>
              )}

              {/* Audio level bar */}
              {micOn && !micError && (
                <Box sx={{
                  width: '80%', height: 4, borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <Box sx={{
                    height: '100%', borderRadius: 2,
                    backgroundColor: audioLevel > 60 ? 'warning.main' : 'success.main',
                    width: `${audioLevel}%`,
                    transition: 'width 0.1s',
                  }} />
                </Box>
              )}
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={onBack}
              sx={{ borderColor: 'rgba(99,102,241,0.3)', color: 'text.secondary' }}
            >
              Back
            </Button>
            <Button
              fullWidth
              variant="contained"
              endIcon={<EnterIcon />}
              onClick={handleJoin}
              sx={{
                background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                fontWeight: 700, fontSize: 16,
                '&:hover': { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
              }}
            >
              Join Room
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

export default LobbyScreen;
