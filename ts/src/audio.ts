// Звук: WebAudio SFX + процедурная музыка — перенос 1:1
import { clamp } from './types';
import { state, SAVE } from './state';

declare global { interface Window { Telegram?: unknown; AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext } }

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
export let muted = !!SAVE.muted;
export let vol = (typeof SAVE.vol === 'number') ? clamp(SAVE.vol | 0, 0, 100) : 80;
let peeSnd: { src: AudioBufferSourceNode; g: GainNode } | null = null;
export let musicVol = (typeof SAVE.mvol === 'number') ? clamp(SAVE.mvol | 0, 0, 100) : 40;
export let musicGain: GainNode | null = null;
let musStep = 0, musNextT = 0, musInt: ReturnType<typeof setInterval> | null = null;
export let vibr = (typeof SAVE.vib === 'boolean') ? SAVE.vib : true;
export function setVibr(v: boolean): void { vibr = v }
export function setVol(v: number): void { vol = v }
export function setMusicVol(v: number): void { musicVol = v }

function masterVal(): number { return muted ? 0 : (vol / 100) * .55 }
export function applyVol(): void { if (master) master.gain.value = masterVal() }
export function setMuted(m: boolean): void { muted = m }
export function isMuted(): boolean { return muted }

export function initAudio(): void {
  if (actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { return }
  master = actx.createGain(); master.gain.value = masterVal(); master.connect(actx.destination);
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, volT: number, delay = 0): void {
  if (!actx || !master) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(volT, t + .02);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .06);
}
function noiseBurst(dur: number, volT: number, freq: number, delay = 0): void {
  if (!actx || !master || !noiseBuf) return;
  const t = actx.currentTime + delay, s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(volT, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
}
export function startPeeSnd(): void {
  if (!actx || !master || peeSnd) return;
  const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 820; f.Q.value = .7;
  const g = actx.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  g.gain.setTargetAtTime(.13, actx.currentTime, .05);
  peeSnd = { src, g };
}
export function stopPeeSnd(): void {
  if (!peeSnd || !actx) return;
  const { src, g } = peeSnd; peeSnd = null;
  g.gain.setTargetAtTime(0, actx.currentTime, .06);
  setTimeout(() => { try { src.stop() } catch (e) { /* noop */ } }, 300);
}
export const sndBark = (): void => { tone('sawtooth', 300, 105, .11, .3, 0); tone('sawtooth', 300, 105, .11, .3, .17); };
export const sndYelp = (): void => tone('sine', 650, 1500, .18, .25);
export const sndMeow = (): void => { tone('sine', 740, 480, .2, .18); tone('sine', 980, 560, .16, .1, .05); };
export const sndCoin = (): void => { tone('square', 900, 900, .07, .12); tone('square', 1350, 1350, .09, .12, .07); };
export const sndPop = (): void => { tone('triangle', 480, 900, .1, .25); tone('square', 1200, 1200, .06, .1, .08); };
export const sndJingle = (): void => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .14, .2, i * .09));
export const sndDrink = (): void => { for (let i = 0; i < 4; i++) tone('sine', 280 + Math.random() * 240, 500 + Math.random() * 200, .07, .14, i * .08); };
export const sndSteal = (): void => tone('sawtooth', 220, 120, .25, .16);
export const sndEnd = (): void => { tone('sine', 1300, 650, .5, .25); [784, 659, 523].forEach((f, i) => tone('triangle', f, f, .18, .16, .55 + i * .14)); };
export const sndRoar = (): void => { tone('sawtooth', 120, 55, .55, .34); noiseBurst(.5, .12, 300, .05); };
export const sndGrowl = (): void => { tone('sawtooth', 95, 60, .3, .28); tone('sawtooth', 140, 90, .22, .2, .1); };
export function sndFlap(): void {
  if (!actx || !master || !noiseBuf) return;
  const t = actx.currentTime, s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
  const g = actx.createGain(); g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + .25);
}
export const sndHit = (): void => { noiseBurst(.12, .3, 500); tone('square', 160, 70, .1, .2); };
export function sndFight(): void {
  sndGrowl(); sndYelp();
  for (let i = 0; i < 3; i++) setTimeout(sndHit, i * 260);
}

export function vib(p: number | number[], style?: string): void {
  if (!vibr) return;
  if (state.mode === 'attract') return; // демо-пёс на титуле не трясёт телефон
  try { if (navigator.vibrate) navigator.vibrate(p) } catch (e) { /* noop */ }
  try {
    const tg = window.Telegram as { WebApp?: { HapticFeedback?: { impactOccurred: (s: string) => void } } } | undefined;
    const h = tg && tg.WebApp && tg.WebApp.HapticFeedback;
    if (h) h.impactOccurred(style || 'medium');
  } catch (e) { /* noop */ }
}

// ---------- процедурная музыка (C-пентатоника) ----------
function initMusic(): void {
  if (!actx || musicGain) return;
  musicGain = actx.createGain(); musicGain.gain.value = musicVal(); musicGain.connect(actx.destination);
}
const PENT = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
const MEL = [0, 2, 4, 7, -1, 7, 4, 5, 7, -1, 5, 4, 2, 0, -1, 2, 4, 5, 7, 4, -1, 2, 0, 2, 0, -1, 2, 4, 5, 7, -1, -1];
const BASSN = [65.41, 49, 55, 43.65];
function musNote(type: OscillatorType, f: number, dur: number, v: number, t: number): void {
  if (!actx || !musicGain) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + .03);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + .05);
}
function musHat(t: number, v: number): void {
  if (!actx || !musicGain || !noiseBuf) return;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = actx.createGain();
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
  s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + .08);
}
function scheduleMus(step: number, t: number): void {
  const m = MEL[step % 32];
  if (m >= 0) musNote('triangle', PENT[m], .34, .14, t);
  if (step % 8 === 0) musNote('sine', BASSN[(step >> 3) & 3], 1.15, .22, t);
  else if (step % 8 === 4) musNote('sine', BASSN[((step >> 3) + 2) & 3], .9, .16, t);
  if (state.mode === 'play') musHat(t, step % 2 ? .05 : .09);
}
function musTick(): void {
  if (!actx || !musicGain) return;
  while (musNextT < actx.currentTime + .4) {
    scheduleMus(musStep, musNextT);
    musNextT += .3125; // 96 BPM, восьмые
    musStep++;
  }
}
export function startMusic(): void {
  if (!actx || musInt) return;
  initMusic();
  if (!actx || !musicGain) return;
  musNextT = actx.currentTime + .1;
  musInt = setInterval(musTick, 180);
}

export function musicVal(): number { return muted ? 0 : (musicVol / 100) * .30 }
export function applyMuteIcons(): void {
  const icoOn = document.getElementById('icoOn') as HTMLElement | null;
  const icoOff = document.getElementById('icoOff') as HTMLElement | null;
  if (icoOn) icoOn.style.display = muted ? 'none' : 'block';
  if (icoOff) icoOff.style.display = muted ? 'block' : 'none';
}
export function toggleSound(): void {
  muted = !muted;
  applyVol();
  applyMuteIcons();
  if (musicGain && actx) musicGain.gain.setTargetAtTime(musicVal(), actx.currentTime, .05);
}
export function getActx(): AudioContext | null { return actx }
