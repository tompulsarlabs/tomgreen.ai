'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Public-demo synthesis only; no voice service, microphone or product connection.
export function useDemoSound(onCoach: boolean) {
  const context = useRef<AudioContext | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const preference = useRef(true);
  const [enabled, setEnabled] = useState(true);
  const stop = useCallback(() => { generation.current++; cleanup.current?.(); cleanup.current = null; }, []);
  const play = useCallback(async (kind: 'arrival' | 'ping') => {
    if (!preference.current || document.hidden) return;
    stop(); const request = generation.current;
    try {
      const audio = context.current ??= new AudioContext();
      await Promise.race([audio.resume(), new Promise((_, reject) => setTimeout(() => reject(new Error('autoplay blocked')), 600))]);
      if (audio.state !== 'running' || request !== generation.current || !preference.current) return;
      const at = audio.currentTime, out = audio.createGain(); out.gain.value = .16; out.connect(audio.destination);
      const nodes: AudioNode[] = [out], sources: OscillatorNode[] = [];
      const oscillator = (frequency: number, gain: number, decay: number, target: AudioNode) => {
        const source = audio.createOscillator(), level = audio.createGain();
        source.frequency.value = frequency; level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(gain, at + (kind === 'ping' ? .025 : .38));
        level.gain.exponentialRampToValueAtTime(.0001, at + decay);
        source.connect(level); level.connect(target); source.start(at); source.stop(at + decay + .05);
        sources.push(source); nodes.push(source, level);
      };
      const duration = kind === 'ping' ? 2.8 : 3.8;
      if (kind === 'ping') {
        const delay = audio.createDelay(1), filter = audio.createBiquadFilter(), feedback = audio.createGain();
        delay.delayTime.value = .34; filter.type = 'lowpass'; filter.frequency.value = 1750; feedback.gain.value = .58;
        const input = audio.createGain(); input.connect(out); input.connect(delay);
        delay.connect(filter); filter.connect(feedback); feedback.connect(delay); feedback.connect(out);
        nodes.push(input, delay, filter, feedback); oscillator(660, .32, .28, input);
      } else {
        for (const [frequency, level] of [[65.4,.08],[130.81,.5],[196,.12],[261.63,.06]]) oscillator(frequency, level, 3.6, out);
      }
      out.gain.setValueAtTime(.16, at + duration - .15); out.gain.linearRampToValueAtTime(0, at + duration);
      const timer = setTimeout(() => { nodes.forEach(node => node.disconnect()); if (generation.current === request) cleanup.current = null; }, duration * 1000 + 100);
      cleanup.current = () => { clearTimeout(timer); out.gain.cancelScheduledValues(audio.currentTime); out.gain.setTargetAtTime(0, audio.currentTime, .015); sources.forEach(source => { try { source.stop(audio.currentTime + .06); } catch {} }); setTimeout(() => nodes.forEach(node => node.disconnect()), 80); };
    } catch { /* Autoplay is optional; the next user gesture can start sound. */ }
  }, [stop]);
  useEffect(() => {
    try { preference.current = localStorage.getItem('radar-demo-sound') !== 'off'; } catch {}
    setEnabled(preference.current);
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); stop(); void context.current?.close().catch(() => {}); context.current = null; };
  }, [stop]);
  useEffect(() => { if (onCoach) void play('arrival'); else stop(); return stop; }, [onCoach, play, stop]);
  function toggle() {
    preference.current = !preference.current; setEnabled(preference.current); stop();
    try { localStorage.setItem('radar-demo-sound', preference.current ? 'on' : 'off'); } catch {}
    if (preference.current && onCoach) void play('arrival');
  }
  return { enabled, play, stop, toggle };
}
