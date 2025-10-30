import { io } from 'socket.io-client';
import { CONFIG } from '../config';

// Create socket instance with configuration from config.js
console.log('🔗 Connecting to server:', CONFIG.SOCKET_URL || 'http://localhost:3001');
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
  withCredentials: false, // Disable for development
  extraHeaders: {
    "my-custom-header": "connect-sphere"
  }
});

// Enhanced connection event handlers
socket.on('connect', () => {
  console.log('Connected to server successfully:', socket.id);
  socket.sendBuffer = []; // Clear any pending messages
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server. Reason:', reason);
  if (reason === 'io server disconnect') {
    // Server initiated disconnect, try reconnecting
    socket.connect();
  }
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // Show error in UI if possible
  if (window.showSnackbar) {
    window.showSnackbar('Connection error: ' + error.message, 'error');
  }
});
console.log('Attempting to connect to:', CONFIG.SOCKET_URL);

socket.on('reconnect', (attemptNumber) => {
  console.log('Successfully reconnected to server after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Attempting to reconnect:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect to server - max attempts reached');
  alert('Connection to server lost. Please refresh the page.');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  if (error === 'Room ID and username are required') {
    alert('Please provide both room ID and username');
  }
});

socket.on('join-error', (error) => {
  console.error('Join error:', error);
  alert('Error joining room: ' + error);
});

// Start the connection
socket.connect();

// Export configured socket instance
export default socket;