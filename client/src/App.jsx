import React, { useState, useEffect } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Fade,
  InputAdornment,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Person as PersonIcon,
  VideoCall as VideoCallIcon,
  ContentCopy as ContentCopyIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import Room from './components/Room'; // Fixed: Using Room instead of RoomRedesigned
import './App.css';

// Create dark theme inspired by Discord
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5865f2',
      light: '#7983f5',
      dark: '#4752c4',
    },
    secondary: {
      main: '#57f287',
      light: '#6bff9a',
      dark: '#4ae374',
    },
    background: {
      default: '#202225',
      paper: '#2f3136',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b9bbbe',
    },
    error: {
      main: '#ed4245',
    },
    success: {
      main: '#57f287',
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#36393f',
            '&:hover': {
              backgroundColor: '#36393f',
            },
            '&.Mui-focused': {
              backgroundColor: '#36393f',
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          padding: '10px 20px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    // Check URL parameters for direct room join
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 15);
    setRoomId(id);
    setSnackbar({ open: true, message: 'Room ID generated!', severity: 'success' });
  };

  const joinRoom = () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    
    setError('');
    setInRoom(true);
  };

  const leaveRoom = () => {
    setInRoom(false);
    setError('');
  };

  const copyRoomLink = () => {
    if (roomId) {
      const link = `${window.location.origin}?room=${roomId}`;
      navigator.clipboard.writeText(link).then(() => {
        setSnackbar({ open: true, message: 'Room link copied to clipboard!', severity: 'success' });
      }).catch(() => {
        setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (inRoom) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Room 
          username={username} 
          roomId={roomId} 
          onLeave={leaveRoom}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
        }}
      >
        <Container maxWidth="sm">
          <Fade in timeout={1000}>
            <Card
              elevation={24}
              sx={{
                backdropFilter: 'blur(20px)',
                backgroundColor: 'rgba(47, 49, 54, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                {/* Logo and Title */}
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <VideoCallIcon 
                    sx={{ 
                      fontSize: 60, 
                      color: 'primary.main',
                      mb: 2,
                    }} 
                  />
                  <Typography 
                    variant="h3" 
                    component="h1" 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #5865f2, #57f287)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 1,
                    }}
                  >
                    ConnectSphere
                  </Typography>
                  <Typography 
                    variant="h6" 
                    color="text.secondary"
                    sx={{ fontWeight: 300 }}
                  >
                    Real-time Video Communication Platform
                  </Typography>
                </Box>

                {/* Form */}
                <Box component="form" sx={{ space: 2 }}>
                  {/* Username Field */}
                  <TextField
                    fullWidth
                    label="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    error={error.includes('username')}
                    helperText={error.includes('username') ? error : ''}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 3 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        joinRoom();
                      }
                    }}
                  />

                  {/* Room ID Field */}
                  <TextField
                    fullWidth
                    label="Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    error={error.includes('room')}
                    helperText={error.includes('room') ? error : 'Enter existing room ID or generate new one'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon color="primary" />
                        </InputAdornment>
                      ),
                      endAdornment: roomId && (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={copyRoomLink}
                            startIcon={<ContentCopyIcon />}
                            sx={{ minWidth: 'auto', p: 1 }}
                          >
                            Copy Link
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 3 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        joinRoom();
                      }
                    }}
                  />

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={generateRoomId}
                      sx={{ 
                        height: 48,
                        borderColor: 'primary.main',
                        '&:hover': {
                          borderColor: 'primary.light',
                          backgroundColor: 'rgba(88, 101, 242, 0.1)',
                        },
                      }}
                    >
                      Generate Room ID
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={joinRoom}
                      disabled={!username.trim() || !roomId.trim()}
                      startIcon={<VideoCallIcon />}
                      sx={{ 
                        height: 48,
                        background: 'linear-gradient(45deg, #5865f2, #57f287)',
                        '&:hover': {
                          background: 'linear-gradient(45deg, #4752c4, #4ae374)',
                        },
                        '&:disabled': {
                          background: 'rgba(255, 255, 255, 0.12)',
                        },
                      }}
                    >
                      Join Room
                    </Button>
                  </Box>

                  {/* Error Display */}
                  {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {error}
                    </Alert>
                  )}
                </Box>

                {/* Features */}
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    ✨ HD Video Calls • 🎤 Crystal Clear Audio • 📱 Screen Sharing • 💬 Real-time Chat
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        </Container>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;