/**
 * useVirtualBackground
 *
 * Applies background blur or a virtual background to a camera stream using
 * TensorFlow.js + MediaPipe Selfie Segmentation.
 *
 * Key fixes:
 *  - Default is 'none' — no GPU cost until user picks an effect
 *  - Model only loads when a non-none bg is requested (lazy init)
 *  - Returns processedStream=null when bg is 'none' (caller uses raw stream)
 *  - Stops the render loop immediately when bg switches back to 'none'
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Singleton segmenter (shared across component remounts) ────────────────
let segmenterPromise = null;

async function getSegmenter() {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    const tf = await import('@tensorflow/tfjs-core');
    await import('@tensorflow/tfjs-converter');
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

const DEFAULT_BG = { type: 'none' }; // ← FIX: was 'blur' — caused instant GPU load

export function useVirtualBackground(rawStream) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [currentBg, _setCurrentBg] = useState(DEFAULT_BG);
  const [processedStream, setProcessedStream] = useState(null);

  const bgRef    = useRef(DEFAULT_BG);
  const rafRef   = useRef(null);
  const activeRef = useRef(false);
  const bgImageRef = useRef(null);

  // Hidden processing elements — created once
  const hiddenVideo = useRef(null);
  const canvas      = useRef(null);
  // Pre-allocated offscreen canvases — reused every frame to avoid GC pressure
  const offCanvas   = useRef(null);
  const maskCanvas  = useRef(null);

  if (!hiddenVideo.current) {
    hiddenVideo.current = document.createElement('video');
    hiddenVideo.current.muted = true;
    hiddenVideo.current.playsInline = true;
  }
  if (!canvas.current) {
    canvas.current = document.createElement('canvas');
  }
  if (!offCanvas.current) {
    offCanvas.current = document.createElement('canvas');
  }
  if (!maskCanvas.current) {
    maskCanvas.current = document.createElement('canvas');
  }

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

  // Public setter — wraps state so we can sync ref
  const setBackground = useCallback((bg) => {
    bgRef.current = bg;
    _setCurrentBg(bg);
    if (bg.type === 'image' && bg.src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { bgImageRef.current = img; };
      img.src = bg.src;
    } else {
      bgImageRef.current = null;
    }
  }, []);

  useEffect(() => {
    // If no stream, clear everything
    if (!rawStream) {
      stopProcessing();
      setProcessedStream(null);
      return;
    }

    // If bg is 'none', stop any active processing and return null
    // so the caller falls back to the raw stream directly
    if (currentBg.type === 'none') {
      stopProcessing();
      setProcessedStream(null);
      return;
    }

    // Audio-only stream — nothing to process visually
    if (rawStream.getVideoTracks().length === 0) {
      setProcessedStream(null);
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
        setProcessedStream(null); // ← FIX: return null so caller uses raw
        setIsLoading(false);
        return;
      }

      if (cancelled) return;

      // Feed raw stream into hidden video
      const vid = hiddenVideo.current;
      vid.srcObject = rawStream;
      await new Promise((resolve) => {
        if (vid.readyState >= 1) {
          vid.play().catch(() => {});
          resolve();
        } else {
          vid.onloadedmetadata = () => {
            vid.play().catch(() => {});
            resolve();
          };
        }
      });

      if (cancelled) return;

      // Ensure video has loaded dimensions to avoid 0x0 canvas / segmenter initialization
      if (vid.videoWidth === 0 || vid.videoHeight === 0) {
        await new Promise((resolve) => {
          const checkSize = () => {
            if (vid.videoWidth > 0 && vid.videoHeight > 0) {
              resolve();
            } else {
              setTimeout(checkSize, 50);
            }
          };
          checkSize();
        });
      }

      const w = vid.videoWidth;
      const h = vid.videoHeight;
      canvas.current.width      = w;
      canvas.current.height     = h;
      offCanvas.current.width   = w;
      offCanvas.current.height  = h;
      maskCanvas.current.width  = w;
      maskCanvas.current.height = h;
      const ctx = canvas.current.getContext('2d');
      const offCtx  = offCanvas.current.getContext('2d');
      const mCtx    = maskCanvas.current.getContext('2d');

      // Canvas video + original audio tracks
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

        // If bg switched back to 'none' mid-session, stop cleanly
        if (bg.type === 'none') {
          stopProcessing();
          setProcessedStream(null);
          return;
        }

        try {
          const results = await segmenter.segmentPeople(vid, {
            flipHorizontal: false,
            multiSegmentation: false,
            segmentBodyParts: false,
          });

          if (!results?.length) {
            ctx.drawImage(vid, 0, 0, w, h);
          } else {
            // ── Draw background ──────────────────────────────────────────────
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

            // ── Composite person mask ────────────────────────────────────────
            const maskData = await bodySegmentation.toBinaryMask(
              results,
              { r: 0, g: 0, b: 0, a: 255 }, // foreground opaque
              { r: 0, g: 0, b: 0, a: 0 },   // background transparent
              false,
              0.65
            );

            // Reuse pre-allocated offscreen canvases (no per-frame allocation)
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.drawImage(vid, 0, 0, w, h);

            const imgData = mCtx.createImageData(w, h);
            imgData.data.set(maskData.data);
            mCtx.putImageData(imgData, 0, 0);

            offCtx.globalCompositeOperation = 'destination-in';
            offCtx.drawImage(maskCanvas.current, 0, 0);

            offCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(offCanvas.current, 0, 0);
          }
        } catch {
          // Fallback to raw frame on any render error
          try { ctx.drawImage(vid, 0, 0, w, h); } catch { /* vid not ready */ }
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
    // Re-run whenever stream changes OR the bg type changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStream, currentBg.type, stopProcessing]);

  return { processedStream, isLoading, error, currentBg, setBackground };
}

export default useVirtualBackground;
