/**
 * VideoPlayer — renders a single participant's video stream.
 *
 * Supports two visual variants:
 *   'large' — full-size featured / pinned view (default)
 *   'thumb' — compact 80×80 thumbnail strip tile
 *
 * Migrated from Room.jsx's inline VideoPlayer (the old standalone
 * VideoPlayer.jsx was out-of-date and unused).
 */
import React, { useRef, useEffect, forwardRef } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
} from '@mui/material';
import {
  MicOff as MicOffIcon,
  ScreenShare as ScreenShareIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  VideocamOff as VideoOffIcon,
} from '@mui/icons-material';
import AnnotationCanvas from './AnnotationCanvas';
import { getInitials } from '../utils/avatarColor';

const VideoPlayer = forwardRef(({
  stream,
  username,
  isLocal      = false,
  isAudioEnabled  = true,
  isVideoEnabled  = true,
  isScreenSharing = false,
  avatarColor  = '#6366f1',
  handRaised   = false,
  userId,
  roomId,
  variant      = 'large', // 'large' | 'thumb'
  isFeatured   = false,
  isPinned     = false,
  onPin,
  onClick,
}, ref) => {
  const videoRef    = useRef(null);
  const resolvedRef = ref || videoRef;
  const initials    = getInitials(username);

  useEffect(() => {
    const el = resolvedRef.current;
    if (el && stream) {
      el.srcObject = stream;
      el.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  }, [stream, resolvedRef]);

  // ── Thumbnail variant ──────────────────────────────────────────────────────
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
        <video
          ref={resolvedRef}
          autoPlay playsInline muted={isLocal}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: isVideoEnabled && stream ? 'block' : 'none',
          }}
        />

        {/* Avatar fallback when camera is off */}
        {(!isVideoEnabled || !stream) && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: avatarColor,
          }}>
            <Typography sx={{
              fontSize: 20, fontWeight: 700, color: '#fff',
              fontFamily: "'Outfit', sans-serif",
            }}>
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
            display: 'block', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isLocal ? 'You' : username?.split(' ')[0]}
          </Typography>
        </Box>

        {/* Muted indicator */}
        {!isAudioEnabled && (
          <MicOffIcon sx={{
            position: 'absolute', top: 4, right: 4,
            fontSize: 10, color: '#ef4444',
            bgcolor: 'rgba(255,255,255,0.9)',
            borderRadius: '50%', p: 0.25,
          }} />
        )}

        {/* Pin button */}
        {!isLocal && onPin && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            sx={{
              position: 'absolute', top: 4, left: 4,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: isPinned ? '#6366f1' : '#ffffff',
              width: 20, height: 20, p: 0.25, zIndex: 5,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              '& .MuiSvgIcon-root': { fontSize: 12 },
            }}
          >
            {isPinned ? <PinIcon /> : <PinOutlinedIcon />}
          </IconButton>
        )}

        {/* Annotation canvas */}
        {roomId && userId && (
          <AnnotationCanvas roomId={roomId} targetUserId={userId} color={avatarColor} isLocal={isLocal} />
        )}
      </Box>
    );
  }

  // ── Large / featured variant ───────────────────────────────────────────────
  return (
    <Box
      className={isLocal ? 'local-video-mirror' : undefined}
      sx={{
        position: 'relative',
        width: '100%', height: '100%',
        borderRadius: '20px',
        overflow: 'hidden',
        background: isVideoEnabled && stream
          ? '#000'
          : `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}44)`,
        boxShadow: '0 8px 40px rgba(99,102,241,0.15)',
        border: '1px solid #e0e7ff',
        flexShrink: 0,
      }}
    >
      <video
        ref={resolvedRef}
        autoPlay playsInline muted={isLocal}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: isVideoEnabled && stream ? 'block' : 'none',
          borderRadius: '20px',
        }}
      />

      {/* Pin button (large view) */}
      {!isLocal && onPin && (
        <IconButton
          size="medium"
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          sx={{
            position: 'absolute', top: 12, left: 12,
            bgcolor: 'rgba(0,0,0,0.5)',
            color: isPinned ? '#818cf8' : '#ffffff',
            zIndex: 5,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          {isPinned ? <PinIcon /> : <PinOutlinedIcon />}
        </IconButton>
      )}

      {/* Annotation canvas */}
      {roomId && userId && (
        <AnnotationCanvas roomId={roomId} targetUserId={userId} color={avatarColor} isLocal={isLocal} />
      )}

      {/* Avatar fallback when camera is off */}
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
          <Typography variant="h6" sx={{
            color: '#1e1b4b', fontFamily: "'Outfit', sans-serif", fontWeight: 600,
          }}>
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
          {handRaised       && <span style={{ fontSize: 16 }}>✋</span>}
          {isScreenSharing  && <ScreenShareIcon sx={{ color: '#f59e0b', fontSize: 16 }} />}
          {!isAudioEnabled  && (
            <Box sx={{
              bgcolor: '#ef4444', borderRadius: '50%',
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MicOffIcon sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}
          {!isVideoEnabled  && (
            <Box sx={{
              bgcolor: '#ef4444', borderRadius: '50%',
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <VideoOffIcon sx={{ fontSize: 14, color: '#fff' }} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;