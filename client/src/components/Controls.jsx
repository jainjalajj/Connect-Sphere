import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Fab,
  ButtonGroup,
  Zoom,
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CallEnd as CallEndIcon,
  Share as ShareIcon,
} from '@mui/icons-material';

function Controls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  onCopyLink,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1,
        p: 2,
        borderRadius: 3,
        backgroundColor: 'rgba(47, 49, 54, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Audio Control */}
      <Tooltip title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}>
        <Zoom in timeout={300}>
          <Fab
            size="medium"
            onClick={onToggleAudio}
            sx={{
              backgroundColor: isAudioEnabled ? 'success.main' : 'error.main',
              color: 'white',
              '&:hover': {
                backgroundColor: isAudioEnabled ? 'success.dark' : 'error.dark',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
              boxShadow: isAudioEnabled 
                ? '0 4px 20px rgba(87, 242, 135, 0.3)' 
                : '0 4px 20px rgba(237, 66, 69, 0.3)',
            }}
          >
            {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Video Control */}
      <Tooltip title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}>
        <Zoom in timeout={400}>
          <Fab
            size="medium"
            onClick={onToggleVideo}
            sx={{
              backgroundColor: isVideoEnabled ? 'success.main' : 'error.main',
              color: 'white',
              '&:hover': {
                backgroundColor: isVideoEnabled ? 'success.dark' : 'error.dark',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
              boxShadow: isVideoEnabled 
                ? '0 4px 20px rgba(87, 242, 135, 0.3)' 
                : '0 4px 20px rgba(237, 66, 69, 0.3)',
            }}
          >
            {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Screen Share Control */}
      <Tooltip title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}>
        <Zoom in timeout={500}>
          <Fab
            size="medium"
            onClick={onToggleScreenShare}
            sx={{
              backgroundColor: isScreenSharing ? 'primary.main' : 'background.paper',
              color: isScreenSharing ? 'white' : 'text.primary',
              border: isScreenSharing ? 'none' : '2px solid',
              borderColor: 'primary.main',
              '&:hover': {
                backgroundColor: isScreenSharing ? 'primary.dark' : 'primary.main',
                color: 'white',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
              boxShadow: isScreenSharing 
                ? '0 4px 20px rgba(88, 101, 242, 0.3)' 
                : '0 2px 10px rgba(0, 0, 0, 0.1)',
            }}
          >
            {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Share Room Link */}
      <Tooltip title="Copy room link">
        <Zoom in timeout={600}>
          <IconButton
            onClick={onCopyLink}
            sx={{
              backgroundColor: 'background.paper',
              color: 'primary.main',
              border: '2px solid',
              borderColor: 'primary.main',
              width: 48,
              height: 48,
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            }}
          >
            <ShareIcon />
          </IconButton>
        </Zoom>
      </Tooltip>

      {/* Leave Room */}
      <Tooltip title="Leave room">
        <Zoom in timeout={700}>
          <Fab
            size="medium"
            onClick={onLeave}
            sx={{
              backgroundColor: 'error.main',
              color: 'white',
              ml: 1,
              '&:hover': {
                backgroundColor: 'error.dark',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 20px rgba(237, 66, 69, 0.3)',
            }}
          >
            <CallEndIcon />
          </Fab>
        </Zoom>
      </Tooltip>
    </Box>
  );
}

export default Controls;