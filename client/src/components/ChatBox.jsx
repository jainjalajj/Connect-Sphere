import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  InputAdornment,
  Fade,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

function ChatBox({ socket, roomId, username }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Listen for incoming messages
    const handleChatMessage = (messageData) => {
      setMessages(prev => [...prev, messageData]);
    };

    // Listen for typing indicators
    const handleTypingStart = (data) => {
      if (data.username !== username) {
        setTypingUsers(prev => {
          if (!prev.includes(data.username)) {
            return [...prev, data.username];
          }
          return prev;
        });
      }
    };

    const handleTypingStop = (data) => {
      if (data.username !== username) {
        setTypingUsers(prev => prev.filter(user => user !== data.username));
      }
    };

    // Listen for room data (initial messages)
    const handleRoomData = (data) => {
      if (data.messages) {
        setMessages(data.messages);
      }
    };

    socket.on('chat-message-received', handleChatMessage);
    socket.on('typing-start', handleTypingStart);
    socket.on('typing-stop', handleTypingStop);
    socket.on('room-data', handleRoomData);

    return () => {
      socket.off('chat-message-received', handleChatMessage);
      socket.off('typing-start', handleTypingStart);
      socket.off('typing-stop', handleTypingStop);
      socket.off('room-data', handleRoomData);
    };
  }, [socket, username]);

  // Send message
  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!message.trim() || !socket) return;

    const messageData = {
      id: Date.now(),
      username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add message locally first for instant feedback
    setMessages(prev => [...prev, messageData]);
    
    // Send to server
    socket.emit('send-chat-message', {
      roomId,
      ...messageData,
    });

    // Clear input and stop typing
    setMessage('');
    handleStopTyping();
  };

  // Handle typing indicators
  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!socket) return;

    // Start typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing-start', { roomId, username });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping && socket) {
      setIsTyping(false);
      socket.emit('typing-stop', { roomId, username });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // Get avatar color based on username
  const getAvatarColor = (name) => {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39',
      '#ffc107', '#ff9800', '#ff5722', '#795548'
    ];
    const index = name?.charCodeAt(0) % colors.length || 0;
    return colors[index];
  };

  // Get initials
  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Box 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
      }}
    >
      {/* Chat Header */}
      <Box 
        sx={{ 
          p: 2, 
          backgroundColor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <ChatIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Chat
        </Typography>
        <Chip 
          label={`${messages.length} messages`}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Messages Area */}
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 1,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.3)',
          },
        }}
      >
        {messages.length === 0 ? (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              opacity: 0.6,
            }}
          >
            <ChatIcon sx={{ fontSize: 48, mb: 2, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No messages yet.<br />
              Start the conversation!
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {messages.map((msg, index) => {
              const isOwnMessage = msg.username === username;
              const showAvatar = index === 0 || messages[index - 1].username !== msg.username;
              
              return (
                <Fade in key={msg.id || index} timeout={300}>
                  <ListItem 
                    sx={{ 
                      px: 1,
                      py: 0.5,
                      alignItems: 'flex-start',
                      flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                    }}
                  >
                    {/* Avatar */}
                    {showAvatar ? (
                      <ListItemAvatar 
                        sx={{ 
                          minWidth: isOwnMessage ? 40 : 48,
                          ml: isOwnMessage ? 1 : 0,
                          mr: isOwnMessage ? 0 : 1,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: 12,
                            fontWeight: 'bold',
                            backgroundColor: getAvatarColor(msg.username),
                          }}
                        >
                          {getInitials(msg.username)}
                        </Avatar>
                      </ListItemAvatar>
                    ) : (
                      <Box sx={{ width: isOwnMessage ? 40 : 48 }} />
                    )}

                    {/* Message Content */}
                    <Box 
                      sx={{ 
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {/* Username and timestamp */}
                      {showAvatar && (
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.5,
                            flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontWeight: 600,
                              color: getAvatarColor(msg.username),
                            }}
                          >
                            {msg.username}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                          >
                            {formatTime(msg.timestamp)}
                          </Typography>
                        </Box>
                      )}

                      {/* Message bubble */}
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          maxWidth: '80%',
                          backgroundColor: isOwnMessage 
                            ? 'primary.main' 
                            : 'background.default',
                          color: isOwnMessage 
                            ? 'primary.contrastText' 
                            : 'text.primary',
                          borderRadius: 2,
                          borderTopLeftRadius: isOwnMessage || !showAvatar ? 2 : 0.5,
                          borderTopRightRadius: !isOwnMessage || !showAvatar ? 2 : 0.5,
                          wordBreak: 'break-word',
                        }}
                      >
                        <Typography variant="body2">
                          {msg.message}
                        </Typography>
                      </Paper>
                    </Box>
                  </ListItem>
                </Fade>
              );
            })}
            
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <Fade in>
                <ListItem sx={{ px: 1, py: 0.5 }}>
                  <ListItemAvatar sx={{ minWidth: 48 }}>
                    <Avatar sx={{ width: 32, height: 32, backgroundColor: 'grey.500' }}>
                      <PersonIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {typingUsers.length === 1 
                        ? `${typingUsers[0]} is typing...`
                        : `${typingUsers.join(', ')} are typing...`
                      }
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      {[0, 1, 2].map((dot) => (
                        <Box
                          key={dot}
                          sx={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            animation: 'typing 1.4s infinite',
                            animationDelay: `${dot * 0.2}s`,
                            '@keyframes typing': {
                              '0%, 60%, 100%': {
                                transform: 'translateY(0)',
                                opacity: 0.5,
                              },
                              '30%': {
                                transform: 'translateY(-10px)',
                                opacity: 1,
                              },
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </ListItem>
              </Fade>
            )}
          </List>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
        <Box 
          component="form" 
          onSubmit={sendMessage}
          sx={{ display: 'flex', gap: 1 }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Type a message..."
            value={message}
            onChange={handleTyping}
            onBlur={handleStopTyping}
            variant="outlined"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Send message">
                    <IconButton 
                      type="submit"
                      disabled={!message.trim()}
                      size="small"
                      sx={{
                        color: 'primary.main',
                        '&:disabled': {
                          color: 'action.disabled',
                        },
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
              sx: {
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'background.paper',
                },
                '&.Mui-focused': {
                  backgroundColor: 'background.paper',
                },
              },
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                sendMessage(e);
              }
            }}
          />
        </Box>
        
        {/* Quick message actions or status */}
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Press Enter to send • Shift + Enter for new line
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default ChatBox;