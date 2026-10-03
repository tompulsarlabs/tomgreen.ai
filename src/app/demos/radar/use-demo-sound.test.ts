// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDemoSound } from './use-demo-sound';

let root: Root;
let host: HTMLDivElement;
let sound: ReturnType<typeof useDemoSound>;
const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
const session = { type: 'auto' };
const audio = {
  state: 'running', currentTime: 0, destination: {},
  resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
  createGain: () => ({ ...node(), gain: parameter() }),
  createDelay: () => ({ ...node(), delayTime: parameter() }),
  createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: parameter() }),
  createOscillator: () => {
    const source = { ...node(), frequency: parameter(), start: vi.fn(), stop: vi.fn() };
    sources.push(source); return source;
  },
};
function Harness({ coach = false }: { coach?: boolean }) { const value = useDemoSound(coach); useEffect(() => { sound = value; }); return null; }
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('AudioContext', vi.fn(function () { return audio; }));
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  localStorage.clear(); sources.length = 0; session.type = 'auto'; audio.state = 'running';
  audio.resume.mockReset().mockResolvedValue(); audio.close.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(() => root.render(createElement(Harness)));
});
afterEach(async () => {
  await act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'audioSession'); Reflect.deleteProperty(document, 'hidden'); vi.unstubAllGlobals();
});

it('starts the ping and resume in the tap stack and uses media output', async () => {
  let resume!: () => void;
  audio.state = 'suspended'; audio.resume.mockImplementation(() => new Promise(resolve => { resume = resolve; }));
  const result = sound.play('ping');
  expect(sources[0].start).toHaveBeenCalledOnce(); expect(audio.resume).toHaveBeenCalledOnce();
  expect(session.type).toBe('playback');
  audio.state = 'running'; resume(); expect(await result).toBe(true);
  sound.stop(); expect(session.type).toBe('auto');
});
it('cancels blocked autoplay so it cannot play after a late unlock', async () => {
  let resume!: () => void;
  audio.state = 'suspended'; audio.resume.mockImplementation(() => new Promise(resolve => { resume = resolve; }));
  const result = sound.play('arrival'); await vi.advanceTimersByTimeAsync(800);
  expect(await result).toBe(false); expect(session.type).toBe('auto');
  for (const source of sources) expect(source.stop).toHaveBeenLastCalledWith(0);
  audio.state = 'running'; resume(); await Promise.resolve(); expect(session.type).toBe('auto');
});
it('restores the session at the end without overriding a recording session', async () => {
  await sound.play('ping'); await vi.advanceTimersByTimeAsync(2900); expect(session.type).toBe('auto');
  await sound.play('ping'); session.type = 'play-and-record'; sound.stop();
  expect(session.type).toBe('play-and-record');
});
it('resumes interrupted audio, and never plays while muted', async () => {
  audio.state = 'interrupted'; audio.resume.mockImplementation(async () => { audio.state = 'running'; });
  expect(await sound.play('ping')).toBe(true);
  await act(() => sound.toggle());
  const count = sources.length; expect(await sound.play('ping')).toBe(false); expect(sources).toHaveLength(count);
});
it('stops on background and only returns with sound when on Coach', async () => {
  await act(() => root.render(createElement(Harness, { coach: true })));
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange')); expect(session.type).toBe('auto');
  const count = sources.length;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); expect(sources.length).toBeGreaterThan(count);
  await act(() => root.render(createElement(Harness, { coach: false })));
  const afterLeaving = sources.length; document.dispatchEvent(new Event('visibilitychange'));
  expect(sources).toHaveLength(afterLeaving);
});
it('plays when Audio Session is unavailable', async () => {
  Reflect.deleteProperty(navigator, 'audioSession'); expect(await sound.play('ping')).toBe(true);
});
