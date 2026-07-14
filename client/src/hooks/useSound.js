/**
 * useSound — plays short audio cues for room events.
 * Uses the Web Audio API to synthesize tones; no external files needed.
 */

let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
};

const playTone = (frequency, duration, type = 'sine', volume = 0.15) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail if audio context is unavailable
  }
};

export const sounds = {
  /** Someone joined the room */
  userJoined: () => {
    playTone(880, 0.12);
    setTimeout(() => playTone(1100, 0.12), 130);
  },
  /** Someone left the room */
  userLeft: () => {
    playTone(660, 0.12);
    setTimeout(() => playTone(440, 0.18), 130);
  },
  /** New chat message received */
  message: () => {
    playTone(1200, 0.08, 'sine', 0.1);
  },
  /** Reaction received */
  reaction: () => {
    playTone(1400, 0.06, 'sine', 0.08);
    setTimeout(() => playTone(1600, 0.06, 'sine', 0.08), 80);
  },
};

export default sounds;
