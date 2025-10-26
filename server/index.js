const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "data:", "blob:"],
      workerSrc: ["'self'", "blob:"],
    }
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.VERCEL_URL, process.env.CLIENT_URL].filter(Boolean)
    : ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization",
    "X-Requested-With",
    "my-custom-header"
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO configuration
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.VERCEL_URL, process.env.CLIENT_URL].filter(Boolean)
      : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: false,
    allowedHeaders: ["my-custom-header"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 10000,
  pingInterval: 5000,
  connectTimeout: 10000,
  maxHttpBufferSize: 1e6 // 1 MB
});

// Data structures to store room and user information
const rooms = new Map();
const users = new Map();

// Utility functions
const getRoomUsers = (roomId) => {
  const room = rooms.get(roomId);
  return room ? Array.from(room.users.values()) : [];
};

const addUserToRoom = (roomId, userId, username) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      users: new Map(),
      messages: [],
      createdAt: new Date(),
    });
  }
  
  const room = rooms.get(roomId);
  const userData = {
    id: userId,
    username: username,
    joinedAt: new Date(),
  };
  
  room.users.set(userId, userData);
  users.set(userId, { ...userData, roomId });
  
  return userData;
};

const removeUserFromRoom = (roomId, userId) => {
  const room = rooms.get(roomId);
  if (room) {
    const userData = room.users.get(userId);
    room.users.delete(userId);
    
    // Remove room if empty
    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
    
    return userData;
  }
  
  users.delete(userId);
  return null;
};

const addMessageToRoom = (roomId, messageData) => {
  const room = rooms.get(roomId);
  if (room) {
    const message = {
      ...messageData,
      id: messageData.id || Date.now() + Math.random(),
      timestamp: messageData.timestamp || new Date().toISOString(),
    };
    
    room.messages.push(message);
    
    // Keep only last 100 messages to prevent memory issues
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }
    
    return message;
  }
  return null;
};

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', (roomId, username) => {
    try {
      console.log('Join room request:', { roomId, username, socketId: socket.id });
      
      if (!roomId || !username) {
        socket.emit('join-error', 'Room ID and username are required');
        return;
      }

      // Leave any previous room
      const previousUser = users.get(socket.id);
      if (previousUser) {
        socket.leave(previousUser.roomId);
        const leftUser = removeUserFromRoom(previousUser.roomId, socket.id);
        if (leftUser) {
          socket.to(previousUser.roomId).emit('user-left', leftUser);
        }
      }

      // Join new room
      socket.join(roomId);
      const userData = addUserToRoom(roomId, socket.id, username);
      
      console.log(`User ${username} (${socket.id}) joined room ${roomId}`);

      // Send room data to the joining user
      const room = rooms.get(roomId);
      const roomData = {
        users: getRoomUsers(roomId),
        messages: room.messages || [],
        roomId: room.id,
        createdAt: room.createdAt
      };
      
      console.log('Sending room data to user:', socket.id, roomData);
      socket.emit('room-data', roomData);

      // Notify other users in the room
      socket.to(roomId).emit('user-joined', userData);

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  // Handle call start events
  socket.on('start-call', (data) => {
    try {
      const { roomId, type, username } = data;
      console.log(`User ${username} started ${type} call in room ${roomId}`);
      
      // Notify all other users in the room that someone started a call
      socket.to(roomId).emit('user-started-call', {
        userId: socket.id,
        username: username,
        type: type
      });
      
    } catch (error) {
      console.error('Error handling start-call:', error);
    }
  });

  // Handle call end events  
  socket.on('end-call', (data) => {
    try {
      const { roomId, username } = data;
      console.log(`User ${username} ended call in room ${roomId}`);
      
      // Notify all users in the room
      socket.to(roomId).emit('call-ended', {
        userId: socket.id,
        username: username
      });
      
    } catch (error) {
      console.error('Error handling end-call:', error);
    }
  });

  // Handle WebRTC signaling - FIXED EVENT NAMES
  socket.on('offer', (data) => {
    try {
      const { target, offer, roomId } = data;
      if (target && offer) {
        socket.to(target).emit('offer', {
          sender: socket.id,
          offer: offer
        });
        console.log(`Offer sent from ${socket.id} to ${target} in room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  });

  socket.on('answer', (data) => {
    try {
      const { target, answer, roomId } = data;
      if (target && answer) {
        socket.to(target).emit('answer', {
          sender: socket.id,
          answer: answer
        });
        console.log(`Answer sent from ${socket.id} to ${target} in room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  });

  socket.on('ice-candidate', (data) => {
    try {
      const { target, candidate, roomId } = data;
      if (target && candidate) {
        socket.to(target).emit('ice-candidate', {
          sender: socket.id,
          candidate: candidate
        });
        console.log(`ICE candidate sent from ${socket.id} to ${target} in room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  });

  // Handle chat messages - FIXED EVENT NAME
  socket.on('send-message', (data) => {
    try {
      const { roomId, username, message } = data;
      
      if (!roomId || !username || !message) {
        socket.emit('error', 'Invalid message data');
        return;
      }

      // Validate message length
      if (message.length > 1000) {
        socket.emit('error', 'Message too long');
        return;
      }

      const messageData = {
        id: data.id || Date.now() + Math.random(),
        username,
        message: message.trim(),
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // Add message to room
      const savedMessage = addMessageToRoom(roomId, messageData);
      
      if (savedMessage) {
        // Broadcast to all users in room (including sender for confirmation)
        io.to(roomId).emit('receive-message', savedMessage);
        console.log(`Message from ${username} in room ${roomId}: ${message}`);
      }

    } catch (error) {
      console.error('Error handling chat message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    try {
      const { roomId, username } = data;
      if (roomId && username) {
        socket.to(roomId).emit('typing-start', { username });
      }
    } catch (error) {
      console.error('Error handling typing start:', error);
    }
  });

  socket.on('typing-stop', (data) => {
    try {
      const { roomId, username } = data;
      if (roomId && username) {
        socket.to(roomId).emit('typing-stop', { username });
      }
    } catch (error) {
      console.error('Error handling typing stop:', error);
    }
  });

  // Handle user disconnection
  socket.on('disconnect', (reason) => {
    try {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      
      const user = users.get(socket.id);
      if (user) {
        const { roomId } = user;
        
        // Remove user from room
        const leftUser = removeUserFromRoom(roomId, socket.id);
        
        // Notify other users in the room with proper user data
        if (leftUser) {
          socket.to(roomId).emit('user-left', leftUser);
        }
        
        console.log(`User ${user.username} left room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    activeUsers: users.size,
  });
});

// Get room information (for debugging)
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    id: room.id,
    userCount: room.users.size,
    messageCount: room.messages.length,
    createdAt: room.createdAt,
    users: getRoomUsers(roomId)
  });
});

// Get server statistics
app.get('/api/stats', (req, res) => {
  res.json({
    activeRooms: rooms.size,
    activeUsers: users.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 ConnectSphere Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Statistics: http://localhost:${PORT}/api/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});