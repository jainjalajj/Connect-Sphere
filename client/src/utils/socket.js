import { io } from 'socket.io-client';
import { CONFIG } from '../config';

// Create socket instance with configuration from config.js
const socket = io(CONFIG.SOCKET_URL || 'http://localhost:3001', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  timeout: 10000,
  autoConnect: true,
  forceNew: true,
  path: '/socket.io',
  withCredentials: false,
  extraHeaders: {
    'my-custom-header': 'connect-sphere',
  },
});

socket.on('connect', () => {
  socket.sendBuffer = []; // Clear any pending messages
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server initiated disconnect — reconnect
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  if (window.showSnackbar) {
    window.showSnackbar('Connection error: ' + error.message, 'error');
  }
});

socket.on('reconnect_failed', () => {
  // Let Room.jsx or App.jsx handle this gracefully via showSnackbar
  if (window.showSnackbar) {
    window.showSnackbar('Connection lost. Please refresh the page.', 'error');
  }
});

// NOTE: Do NOT register 'join-error' or 'error' handlers here.
// Room.jsx registers its own handlers that call onLeave() + showSnackbar.
// A global handler here would fire a duplicate alert alongside Room's handler.

export default socket;