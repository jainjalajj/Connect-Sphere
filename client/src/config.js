const getServerUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (!envUrl || envUrl.includes('your-actual-server.railway.app')) {
    if (typeof window !== 'undefined') {
      const hn = window.location.hostname;
      if (hn === 'localhost' || hn === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      return window.location.origin;
    }
    return 'http://localhost:3001';
  }
  return envUrl;
};

export const CONFIG = {
  SOCKET_URL: getServerUrl(),
  SOCKET_OPTIONS: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
  },
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  MEDIA_CONSTRAINTS: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }
};