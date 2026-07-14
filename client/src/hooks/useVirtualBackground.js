/**
 * useVirtualBackground
 *
 * Applies background blur or a virtual background colour/image to a camera
 * stream using TensorFlow.js + MediaPipe Selfie Segmentation.
 *
 * Pipeline:
 *   rawCameraStream → hidden <video> → TF segmentation → <canvas> → captureStream()
 *
 * Returns:
 *   processedStream  — MediaStream to use instead of raw camera stream
 *   isLoading        — true while the model is loading on first activation
 *   error            — string | null
 *   currentBg        — active BackgroundConfig
 *   setBackground    — (bg: BackgroundConfig) => void
 *
 * BackgroundConfig:
 *   { type: 'none' }
 *   { type: 'blur', radius: number }
 *   { type: 'color', color: string }
 *   { type: 'image', src: string, label?: string }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Singleton segmenter (shared across component remounts) ─────────────────
let segmenterPromise = null;

async function getSegmenter() {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    // Static imports — Vite will bundle these into the tfjs chunk
    const tf = await import('@tensorflow/tfjs-core');
    await import('@tensorflow/tfjs-backend-webgl');
    const bodySegmentation = await import('@tensorflow-models/body-segmentation');

    await tf.ready();

    const segmenter = await bodySegmentation.createSegmenter(
      bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
      { runtime: 'tfjs', modelType: 'general' }
    );

    return { segmenter, bodySegmentation };
  })();

  return segmenterPromise;
}

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BG = { type: 'blur', radius: 10 };

export function useVirtualBackground(rawStream) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentBg, setCurrentBg] = useState(DEFAULT_BG);
  const [processedStream, setProcessedStream] = useState(null);

  const bgRef = useRef(DEFAULT_BG);
  const rafRef = useRef(null);
  const activeRef = useRef(false);
  const bgImageRef = useRef(null);

  // Hidden elements — created once
  const hiddenVideo = useRef(null);
  const canvas = useRef(null);

  if (!hiddenVideo.current) {
    hiddenVideo.current = document.createElement('video');
    hiddenVideo.current.muted = true;
    hiddenVideo.current.playsInline = true;
  }
  if (!canvas.current) {
    canvas.current = document.createElement('canvas');
  }

  const setBackground = useCallback((bg) => {
    bgRef.current = bg;
    setCurrentBg(bg);
    if (bg.type === 'image' && bg.src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { bgImageRef.current = img; };
      img.src = bg.src;
    } else {
      bgImageRef.current = null;
    }
  }, []);

  const stopProcessing = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const vid = hiddenVideo.current;
    vid.pause();
    vid.srcObject = null;
  }, []);

  useEffect(() => {
    if (!rawStream) {
      stopProcessing();
      setProcessedStream(null);
      return;
    }

    const hasVideo = rawStream.getVideoTracks().length > 0;
    if (!hasVideo) {
      // Audio-only — nothing to process
      setProcessedStream(rawStream);
      return;
    }

    let cancelled = false;

    const start = async () => {
      setIsLoading(true);
      setError(null);

      let segmenter, bodySegmentation;
      try {
        ({ segmenter, bodySegmentation } = await getSegmenter());
      } catch (e) {
        console.error('[VirtualBg] Model load failed:', e);
        setError('Background model failed to load. Using raw camera.');
        setProcessedStream(rawStream);
        setIsLoading(false);
        return;
      }

      if (cancelled) return;

      // Feed raw stream into hidden video
      const vid = hiddenVideo.current;
      vid.srcObject = rawStream;
      await new Promise((resolve) => {
        vid.onloadedmetadata = () => {
          vid.play().catch(() => {});
          resolve();
        };
      });

      if (cancelled) return;

      const w = vid.videoWidth || 640;
      const h = vid.videoHeight || 480;
      canvas.current.width = w;
      canvas.current.height = h;
      const ctx = canvas.current.getContext('2d');

      // Build processed stream: canvas video + original audio
      const canvasStream = canvas.current.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...rawStream.getAudioTracks(),
      ]);

      setProcessedStream(combined);
      setIsLoading(false);
      activeRef.current = true;

      // ── Per-frame render loop ──────────────────────────────────────────────
      const render = async () => {
        if (!activeRef.current) return;

        const bg = bgRef.current;

        try {
          if (bg.type === 'none') {
            ctx.drawImage(vid, 0, 0, w, h);
          } else {
            const results = await segmenter.segmentPeople(vid, {
              flipHorizontal: false,
              multiSegmentation: false,
              segmentBodyParts: false,
            });

            if (!results?.length) {
              ctx.drawImage(vid, 0, 0, w, h);
            } else {
              // ── Draw background ──────────────────────────────────────────
              if (bg.type === 'blur') {
                ctx.save();
                ctx.filter = `blur(${bg.radius ?? 10}px)`;
                ctx.drawImage(vid, 0, 0, w, h);
                ctx.filter = 'none';
                ctx.restore();
              } else if (bg.type === 'color') {
                ctx.fillStyle = bg.color ?? '#1a1a2e';
                ctx.fillRect(0, 0, w, h);
              } else if (bg.type === 'image' && bgImageRef.current) {
                ctx.drawImage(bgImageRef.current, 0, 0, w, h);
              } else {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, w, h);
              }

              // ── Composite person via segmentation mask ───────────────────
              const maskData = await bodySegmentation.toBinaryMask(
                results,
                { r: 0, g: 0, b: 0, a: 255 }, // foreground opaque
                { r: 0, g: 0, b: 0, a: 0 },   // background transparent
                false,
                0.65
              );

              // Off-screen: raw frame clipped to person mask
              const off = document.createElement('canvas');
              off.width = w; off.height = h;
              const offCtx = off.getContext('2d');
              offCtx.drawImage(vid, 0, 0, w, h);

              const maskCanvas = document.createElement('canvas');
              maskCanvas.width = w; maskCanvas.height = h;
              const mCtx = maskCanvas.getContext('2d');
              const imgData = mCtx.createImageData(w, h);
              imgData.data.set(maskData.data);
              mCtx.putImageData(imgData, 0, 0);

              offCtx.globalCompositeOperation = 'destination-in';
              offCtx.drawImage(maskCanvas, 0, 0);

              // Composite person on top of background
              ctx.drawImage(off, 0, 0);
            }
          }
        } catch {
          // Fallback to raw frame on any render error
          ctx.drawImage(vid, 0, 0, w, h);
        }

        rafRef.current = requestAnimationFrame(render);
      };

      render();
    };

    start();

    return () => {
      cancelled = true;
      stopProcessing();
    };
  }, [rawStream, stopProcessing]);

  return { processedStream, isLoading, error, currentBg, setBackground };
}

export default useVirtualBackground;
