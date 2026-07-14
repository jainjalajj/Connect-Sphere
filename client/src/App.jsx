import { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Fade,
  InputAdornment,
  Alert,
  Snackbar,
  Avatar,
  Tooltip,
  Slider,
  Collapse,
} from '@mui/material';
import {
  Person as PersonIcon,
  VideoCall as VideoCallIcon,
  ContentCopy as ContentCopyIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  People as PeopleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import Room from './components/Room';
import LobbyScreen from './components/LobbyScreen';
import { generateEncryptionKey } from './utils/crypto';
import './App.css';

// Avatar color palette
const AVATAR_COLORS = [
  '#5865f2', '#57f287', '#ed4245', '#faa61a',
  '#eb459e', '#3498db', '#2ecc71', '#e74c3c',
  '#9b59b6', '#1abc9c', '#e67e22', '#f1c40f',
];

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#5865f2', light: '#7983f5', dark: '#4752c4' },
    secondary: { main: '#57f287', light: '#6bff9a', dark: '#4ae374' },
    background: { default: '#202225', paper: '#2f3136' },
    text: { primary: '#ffffff', secondary: '#b9bbbe' },
    error: { main: '#ed4245' },
    success: { main: '#57f287' },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#36393f',
            '&:hover': { backgroundColor: '#36393f' },
            '&.Mui-focused': { backgroundColor: '#36393f' },
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
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});

function App() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [e2eKey, setE2eKey] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [inRoom, setInRoom] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [mediaPrefs, setMediaPrefs] = useState({ startWithVideo: true, startWithAudio: true });
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) setRoomId(roomParam);
    
    // Check for E2E key in hash
    const hash = window.location.hash;
    if (hash && hash.startsWith('#key=')) {
      setE2eKey(hash.substring(5));
      // Remove hash from URL to keep it hidden
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Restore last avatar color
    const saved = localStorage.getItem('cs_avatar_color');
    if (saved && AVATAR_COLORS.includes(saved)) setAvatarColor(saved);

    // Bind global snackbar handler for socket.js or utility alerts
    window.showSnackbar = (msg, severity = 'info') => {
      setSnackbar({ open: true, message: msg, severity });
    };

    return () => {
      window.showSnackbar = null;
    };
  }, []);

  const generateRoomId = async () => {
    const id = Math.random().toString(36).substring(2, 15);
    setRoomId(id);
    try {
      const key = await generateEncryptionKey();
      setE2eKey(key);
      setSnackbar({ open: true, message: 'Room ID & E2EE Key generated!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Room ID generated, but E2EE generation failed', severity: 'warning' });
    }
  };

  const joinRoom = () => {
    if (!username.trim()) { setError('Please enter your username'); return; }
    if (!roomId.trim()) { setError('Please enter a room ID'); return; }
    localStorage.setItem('cs_avatar_color', avatarColor);
    setError('');
    setInLobby(true); // go to lobby first
  };

  const leaveRoom = () => { setInRoom(false); setInLobby(false); setError(''); };

  const copyRoomLink = () => {
    if (!roomId) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}${e2eKey ? `#key=${e2eKey}` : ''}`;
    navigator.clipboard.writeText(link)
      .then(() => setSnackbar({ open: true, message: 'Room link copied!', severity: 'success' }))
      .catch(() => setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' }));
  };

  const getInitials = (name) =>
    name?.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || '?';

  if (inLobby && !inRoom) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <LobbyScreen
          username={username}
          roomId={roomId}
          avatarColor={avatarColor}
          onJoin={(prefs) => {
            setMediaPrefs(prefs);
            setInLobby(false);
            setInRoom(true);
          }}
          onBack={() => setInLobby(false)}
        />
      </ThemeProvider>
    );
  }

  if (inRoom) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Room
          username={username}
          roomId={roomId}
          password={password}
          e2eKey={e2eKey}
          maxParticipants={maxParticipants}
          avatarColor={avatarColor}
          startWithVideo={mediaPrefs.startWithVideo}
          startWithAudio={mediaPrefs.startWithAudio}
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
                  <VideoCallIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
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
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 300 }}>
                    Real-time Video Communication Platform
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Avatar color picker + username row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Preview avatar */}
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        backgroundColor: avatarColor,
                        fontSize: 20,
                        fontWeight: 700,
                        flexShrink: 0,
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      {getInitials(username) || <PersonIcon />}
                    </Avatar>

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
                      onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                    />
                  </Box>

                  {/* Color picker row */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Pick your avatar color
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {AVATAR_COLORS.map((color) => (
                        <Tooltip key={color} title={color}>
                          <Box
                            onClick={() => setAvatarColor(color)}
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              backgroundColor: color,
                              cursor: 'pointer',
                              border: avatarColor === color
                                ? '3px solid white'
                                : '2px solid transparent',
                              transition: 'transform 0.15s',
                              '&:hover': { transform: 'scale(1.2)' },
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>

                  {/* Room ID field */}
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
                            Copy
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                  />

                  {/* Advanced options toggle */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary' },
                    }}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Typography variant="body2" sx={{ mr: 0.5 }}>
                      Advanced options
                    </Typography>
                    {showAdvanced ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </Box>

                  <Collapse in={showAdvanced}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                      {/* Room password */}
                      <TextField
                        fullWidth
                        label="Room Password (optional)"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        helperText="Set a password when creating a room, or enter it to join a protected room"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon color="primary" />
                            </InputAdornment>
                          ),
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                      />

                      {/* Participant limit */}
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PeopleIcon fontSize="small" color="primary" />
                            Max participants
                          </Typography>
                          <Typography variant="body2" color="primary.main" fontWeight={700}>
                            {maxParticipants}
                          </Typography>
                        </Box>
                        <Slider
                          value={maxParticipants}
                          onChange={(_, v) => setMaxParticipants(v)}
                          min={2}
                          max={20}
                          step={1}
                          marks={[
                            { value: 2, label: '2' },
                            { value: 8, label: '8' },
                            { value: 20, label: '20' },
                          ]}
                          sx={{ color: 'primary.main' }}
                        />
                      </Box>
                    </Box>
                  </Collapse>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
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
                        '&:hover': { background: 'linear-gradient(45deg, #4752c4, #4ae374)' },
                        '&:disabled': { background: 'rgba(255, 255, 255, 0.12)' },
                      }}
                    >
                      Join Room
                    </Button>
                  </Box>

                  {error && !error.includes('username') && !error.includes('room') && (
                    <Alert severity="error">{error}</Alert>
                  )}
                </Box>

                {/* Feature tags */}
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    ✨ HD Video • 🎤 Audio • 📱 Screen Share • 💬 Chat • 🔴 Record • 🙋 Reactions
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        </Container>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
