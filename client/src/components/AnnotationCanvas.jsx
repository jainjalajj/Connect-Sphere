import React, { useRef, useEffect, useState } from 'react';
import socket from '../utils/socket';

const FADE_DURATION = 3000; // 3 seconds

export default function AnnotationCanvas({ roomId, targetUserId, color = '#ff0000', isLocal }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPathRef = useRef([]);
  const [annotations, setAnnotations] = useState([]);

  // Draw loop — only active when there are annotations or the user is drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Nothing to draw — skip the RAF loop entirely
    if (annotations.length === 0 && !isDrawing) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const ctx = canvas.getContext('2d');
    let animationFrame;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();
      
      const activeAnnotations = annotations.filter(a => now - a.timestamp < FADE_DURATION);
      if (activeAnnotations.length !== annotations.length) {
        setAnnotations(activeAnnotations);
      }

      // Draw all active paths
      activeAnnotations.forEach(ann => {
        if (!ann.points || ann.points.length < 2) return;
        const opacity = Math.max(0, 1 - (now - ann.timestamp) / FADE_DURATION);
        
        ctx.beginPath();
        const alphaHex = Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = `${ann.color}${alphaHex}`;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ann.points.forEach((p, i) => {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });

      // Draw current path
      if (currentPathRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        currentPathRef.current.forEach((p, i) => {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [annotations, color, isDrawing]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    updateSize();
    // Poll for resize occasionally if container resizes without window resize
    const interval = setInterval(updateSize, 1000);
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearInterval(interval);
    };
  }, []);

  // Listen for remote annotations
  useEffect(() => {
    const onAnnotation = (data) => {
      if (data.targetUserId === targetUserId) {
        setAnnotations(prev => [
          ...prev, 
          { id: Date.now() + Math.random(), points: data.points, color: data.color, timestamp: Date.now() }
        ]);
      }
    };
    socket.on('annotation-received', onAnnotation);
    return () => socket.off('annotation-received', onAnnotation);
  }, [targetUserId]); // socket is a module singleton — stable, not a dep

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (e) => {
    setIsDrawing(true);
    currentPathRef.current = [getCoordinates(e)];
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    currentPathRef.current.push(getCoordinates(e));
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Broadcast the finished stroke
    if (currentPathRef.current.length > 1 && socket) {
      socket.emit('annotate', {
        roomId,
        targetUserId,
        points: currentPathRef.current,
        color
      });
      // Add locally immediately
      setAnnotations(prev => [
        ...prev, 
        { id: Date.now(), points: [...currentPathRef.current], color, timestamp: Date.now() }
      ]);
    }
    currentPathRef.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        zIndex: 10,
        touchAction: 'none' // Prevent scrolling on mobile
      }}
    />
  );
}
