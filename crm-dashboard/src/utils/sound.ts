/**
 * Sound Engine for Traket CRM Lead Notifications
 * Uses standard Web Audio API for crisp zero-latency notification chimes
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

// Initialize or resume AudioContext safely on first user gesture
export function initAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('AudioContext initialization prevented:', err);
    return null;
  }
}

// Audio mute state management
export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  try {
    localStorage.setItem('traket_audio_muted', muted ? '1' : '0');
  } catch (_) {}
}

export function isAudioMuted(): boolean {
  try {
    return localStorage.getItem('traket_audio_muted') === '1' || isMuted;
  } catch (_) {
    return isMuted;
  }
}

// Retained for backward compatibility as no-ops
export function setVoiceEnabled(_enabled: boolean) {}

export function isVoiceNotificationEnabled(): boolean {
  return false;
}

/**
 * Play an elegant high-priority 4-note ascending dispatch chime
 */
export function playDispatchChime() {
  if (isAudioMuted()) return;
  const ctx = initAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: 0.0, duration: 0.18 }, // C5
    { freq: 659.25, time: 0.12, duration: 0.20 }, // E5
    { freq: 783.99, time: 0.24, duration: 0.22 }, // G5
    { freq: 1046.5, time: 0.36, duration: 0.45 }, // C6 (resonant bell)
  ];

  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0, now + time);
    gain.gain.linearRampToValueAtTime(0.3, now + time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + duration);
  });
}

/**
 * Voice announcement disabled: keeps only notification sound.
 * Cancels any active browser speech synthesis.
 */
export function speakLeadAnnouncement(_text?: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch (_) {}
}
