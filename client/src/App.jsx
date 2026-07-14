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

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
    secondary:  { main: '#10b981', light: '#34d399', dark: '#059669' },
    background: { default: '#f8f9ff', paper: '#ffffff' },
    text:       { primary: '#1e1b4b', secondary: '#64748b' },
    error:      { main: '#ef4444' },
    success:    { main: '#10b981' },
    warning:    { main: '#f59e0b' },
    divider:    '#e2e8f0',
  },
  typography: {
    fontFamily: `'Outfit', 'Segoe UI', sans-serif`,
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700, letterSpacing: '-0.5px' },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontFamily: `'Outfit', sans-serif`, fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { fontFamily: `'Outfit', sans-serif`, background: '#f8f9ff' } },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#f8faff',
            borderRadius: 12,
            '& fieldset': { borderColor: '#e0e7ff' },
            '&:hover fieldset': { borderColor: '#6366f1' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1' },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          fontWeight: 600,
          fontFamily: `'Outfit', sans-serif`,
          padding: '10px 22px',
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          background: 'linear-gradient(135deg, #818cf8, #6366f1)',
          boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
          color: '#fff',
          '&:hover': {
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            boxShadow: '0 8px 28px rgba(99,102,241,0.45)',
            transform: 'translateY(-2px)',
          },
          '&:disabled': { background: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' },
        },
        outlined: {
          borderColor: '#c7d2fe',
          color: '#6366f1',
          '&:hover': { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: '#ffffff',
          border: '1px solid #e0e7ff',
          boxShadow: '0 4px 24px rgba(99,102,241,0.08)',
          borderRadius: 20,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: `'Outfit', sans-serif`, fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { color: '#6366f1' },
        thumb: { '&:hover': { boxShadow: '0 0 0 8px rgba(99,102,241,0.16)' } },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1e1b4b',
          boxShadow: '0 1px 0 #e0e7ff',
        },
      },
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
      <ThemeProvider theme={lightTheme}>
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
      <ThemeProvider theme={lightTheme}>
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
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          background: 'linear-gradient(135deg, #eef2ff 0%, #f8f9ff 50%, #fdf4ff 100%)',
        }}
      >
        <Container maxWidth="sm">
          <Fade in timeout={800}>
            <Card elevation={2} sx={{ borderRadius: 6, p: 2, backgroundColor: '#ffffff' }}>
              <CardContent sx={{ p: 4 }}>
                {/* Logo and Title */}
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box sx={{
                    width: 72, height: 72,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 2,
                    boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
                  }}>
                    <VideoCallIcon sx={{ fontSize: 38, color: 'white' }} />
                  </Box>
                  <Typography
                    variant="h3"
                    component="h1"
                    sx={{
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #e0dfff 0%, #7c6ff7 50%, #57f287 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 0.75,
                      letterSpacing: '-1px',
                    }}
                  >
                    ConnectSphere
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 400, opacity: 0.8 }}>
                    Secure • Real-time • End-to-end encrypted
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

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={generateRoomId}
                      sx={{
                        height: 50,
                        borderColor: 'rgba(124,111,247,0.4)',
                        color: 'primary.light',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'rgba(124,111,247,0.1)',
                          transform: 'translateY(-1px)',
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
                      sx={{ height: 50 }}
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
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                    {['🎥 HD Video', '🔐 E2EE', '🖥️ Screen Share', '💬 Chat', '🎨 Annotations', '🔴 Record'].map(tag => (
                      <Box key={tag} sx={{
                        px: 1.5, py: 0.5, borderRadius: 99,
                        background: 'rgba(124,111,247,0.1)',
                        border: '1px solid rgba(124,111,247,0.2)',
                        fontSize: '0.75rem', color: 'text.secondary',
                      }}>{tag}</Box>
                    ))}
                  </Box>
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
