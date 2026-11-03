/**
 * Sound & Voice Synthesis Engine for Traket CRM Lead Notifications
 * Uses standard Web Audio API for crisp zero-latency chimes
 * Uses Web Speech Synthesis API for automated voice announcements
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;
let isVoiceEnabled = true;

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

export function setVoiceEnabled(enabled: boolean) {
  isVoiceEnabled = enabled;
  try {
    localStorage.setItem('traket_voice_enabled', enabled ? '1' : '0');
  } catch (_) {}
}

export function isVoiceNotificationEnabled(): boolean {
  try {
    const stored = localStorage.getItem('traket_voice_enabled');
    return stored === null ? true : stored === '1';
  } catch (_) {
    return isVoiceEnabled;
  }
}

/**
 * Play an elegant high-priority 3-note ascending dispatch chime
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
 * Speak voice announcement for the incoming lead
 */
export function speakLeadAnnouncement(text: string) {
  if (isAudioMuted() || !isVoiceNotificationEnabled()) return;
  if (!('speechSynthesis' in window)) return;

  try {
    // Chrome bug fix: resume speech synthesis if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    // Cancel any previous pending speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('India'))) ||
      voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Small delay to let the chime ring out first
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech speak failed:', e);
      }
    }, 450);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}
