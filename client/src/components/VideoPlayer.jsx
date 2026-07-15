import React, { useRef, useEffect, forwardRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Fade,
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon,
  Person as PersonIcon,
  SignalWifi4Bar as SignalWifi4BarIcon,
  SignalWifiOff as SignalWifiOffIcon,
} from '@mui/icons-material';

const VideoPlayer = forwardRef(({ 
  stream, 
  username, 
  isLocal = false, 
  isAudioEnabled = true, 
  isVideoEnabled = true, 
  isScreenSharing = false,
  userId,
  avatarColor = null,
  handRaised = false,
  roomId = null,
  variant = 'large', // 'large' or 'thumb'
  isPinned = false,
  onPin = null,
}, ref) => {
  const videoRef = useRef();
  const [isConnected, setIsConnected] = React.useState(false);
  const [videoLoaded, setVideoLoaded] = React.useState(false);

  useEffect(() => {
    const video = ref || videoRef;
    
    const setupVideo = async () => {
      if (video.current && stream) {
        try {
          // Reset video element
          video.current.srcObject = null;
          
          // Set new stream
          video.current.srcObject = stream;
          setIsConnected(true);
          
          // Wait for metadata to load
          await new Promise((resolve) => {
            const handleLoadedMetadata = () => {
              setVideoLoaded(true);
              video.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
              resolve();
            };
            video.current.addEventListener('loadedmetadata', handleLoadedMetadata);
          });
          
          // Try to play
          try {
            await video.current.play();
            console.log('Video playing successfully');
          } catch (error) {
            console.error('Error playing video:', error);
            // Try playing without audio if autoplay fails
            video.current.muted = true;
            await video.current.play();
          }
        } catch (error) {
          console.error('Error setting up video:', error);
          setIsConnected(false);
          setVideoLoaded(false);
        }
      } else {
        setIsConnected(false);
        setVideoLoaded(false);
        if (video.current) {
          video.current.srcObject = null;
        }
      }
    };

    setupVideo();

    return () => {
      if (video.current) {
        video.current.srcObject = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // Get initials for avatar
  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  // Get avatar color based on username
  const getAvatarColor = (name) => {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const index = name?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  return (
    <Card 
      elevation={isLocal ? 8 : 4} 
      className={isLocal ? 'local-video-mirror' : undefined}
      sx={{ 
        height: '100%', 
        position: 'relative', 
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        border: isLocal ? '2px solid' : '1px solid',
        borderColor: isLocal ? 'primary.main' : 'divider',
        transition: 'all 0.3s ease',
        '&:hover': {
          elevation: 8,
          borderColor: 'primary.main',
        }
      }}
    >
      {/* Video/Audio Element Container */}
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {stream ? (
          <>
            {stream.getVideoTracks().length > 0 && (
              <video
                ref={ref || videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: (isVideoEnabled && videoLoaded) ? 'block' : 'none',
                  backgroundColor: 'transparent'
                }}
              />
            )}
            <audio
              ref={!stream.getVideoTracks().length && (ref || videoRef)}
              autoPlay
              playsInline
              muted={isLocal}
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <Typography variant="body1" color="text.secondary">
            {isLocal ? 'Camera access required' : 'Waiting for video...'}
          </Typography>
        )}
      </Box>

      {/* Avatar when video is disabled or not loaded */}
      {(!isVideoEnabled || !videoLoaded || !stream) && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          }}
        >
          <Fade in timeout={500}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: variant === 'thumb' ? 44 : 80,
                  height: variant === 'thumb' ? 44 : 80,
                  fontSize: variant === 'thumb' ? 18 : 32,
                  fontWeight: 'bold',
                  backgroundColor: avatarColor || getAvatarColor(username),
                  mb: variant === 'thumb' ? 0.5 : 2,
                  mx: 'auto',
                }}
              >
                {!stream ? <PersonIcon fontSize={variant === 'thumb' ? 'medium' : 'large'} /> : getInitials(username)}
              </Avatar>
              {!stream && variant !== 'thumb' && (
                <Typography variant="body2" color="text.secondary">
                  {isLocal ? 'Initializing camera...' : 'Connecting...'}
                </Typography>
              )}
            </Box>
          </Fade>
        </Box>
      )}

      {/* Video Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Status Bar */}
      <Box
        sx={{
          position: 'absolute',
          top: variant === 'thumb' ? 4 : 8,
          left: variant === 'thumb' ? 4 : 8,
          right: variant === 'thumb' ? 4 : 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 2,
        }}
      >
        {/* Username */}
        <Chip
          label={username}
          size="small"
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            fontWeight: isLocal ? 600 : 400,
            backdropFilter: 'blur(4px)',
            maxWidth: variant === 'thumb' ? 70 : 150,
            height: variant === 'thumb' ? 18 : 24,
            fontSize: variant === 'thumb' ? '8px' : '11px',
            '& .MuiChip-label': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              px: variant === 'thumb' ? 0.8 : 1.5,
            },
          }}
        />

        {/* Connection Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isConnected ? (
            <SignalWifi4BarIcon 
              sx={{ 
                color: 'success.main', 
                fontSize: variant === 'thumb' ? 12 : 16,
                filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
              }} 
            />
          ) : (
            <SignalWifiOffIcon 
              sx={{ 
                color: 'error.main', 
                fontSize: variant === 'thumb' ? 12 : 16,
                filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
              }} 
            />
          )}
          
          {isScreenSharing && (
            <ScreenShareIcon 
              sx={{ 
                color: 'primary.main', 
                fontSize: variant === 'thumb' ? 12 : 16,
                filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
              }} 
            />
          )}
        </Box>
      </Box>

      {/* Bottom Status Bar */}
      {/* Bottom Status Bar for Large View */}
      {variant !== 'thumb' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            zIndex: 2,
          }}
        >
          {/* Audio Status */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: isAudioEnabled 
                ? 'rgba(87, 242, 135, 0.2)' 
                : 'rgba(237, 66, 69, 0.2)',
              border: '1px solid',
              borderColor: isAudioEnabled ? 'success.main' : 'error.main',
              backdropFilter: 'blur(4px)',
            }}
          >
            {isAudioEnabled ? (
              <MicIcon 
                sx={{ 
                  color: 'success.main', 
                  fontSize: 16,
                  filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
                }} 
              />
            ) : (
              <MicOffIcon 
                sx={{ 
                  color: 'error.main', 
                  fontSize: 16,
                  filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
                }} 
              />
            )}
          </Box>

          {/* Video Status */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: isVideoEnabled 
                ? 'rgba(87, 242, 135, 0.2)' 
                : 'rgba(237, 66, 69, 0.2)',
              border: '1px solid',
              borderColor: isVideoEnabled ? 'success.main' : 'error.main',
              backdropFilter: 'blur(4px)',
            }}
          >
            {isVideoEnabled ? (
              <VideocamIcon 
                sx={{ 
                  color: 'success.main', 
                  fontSize: 16,
                  filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
                }} 
              />
            ) : (
              <VideocamOffIcon 
                sx={{ 
                  color: 'error.main', 
                  fontSize: 16,
                  filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.3))'
                }} 
              />
            )}
          </Box>

          {/* Large View Hand Raised Indicator */}
          {handRaised && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid',
                borderColor: 'warning.main',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Typography sx={{ fontSize: 16 }}>✋</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Small corner indicators for Thumbnail View */}
      {variant === 'thumb' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            zIndex: 2,
          }}
        >
          {!isAudioEnabled && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%',
              backgroundColor: 'rgba(237, 66, 69, 0.9)',
              color: 'white',
            }}>
              <MicOffIcon sx={{ fontSize: 11 }} />
            </Box>
          )}
          {!isVideoEnabled && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%',
              backgroundColor: 'rgba(237, 66, 69, 0.9)',
              color: 'white',
            }}>
              <VideocamOffIcon sx={{ fontSize: 11 }} />
            </Box>
          )}
          {handRaised && (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.9)',
              fontSize: 10,
            }}>
              ✋
            </Box>
          )}
        </Box>
      )}

      {/* Local Video Mirror Effect */}
      {isLocal && (
        <style>
          {`
            .local-video-mirror video {
              transform: scaleX(-1);
            }
          `}
        </style>
      )}
    </Card>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;