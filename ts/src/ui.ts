// UI: применение локали, тосты, превью породы, экраны — перенос 1:1
import { W, H, TAU, $ } from './types';
import { LN, lang, state, skinIdx, setSkinIdx, SK, SKINS, diffKey, setDiffKey, mapKey, setMapKey, SAVE, playerNameStr, updatePlayerName } from './state';
import { drawDog } from './sprites';
import { applyVol, initAudio, toggleSound, setVol, setMusicVol, setMuted, musicGain, applyMuteIcons } from './audio';
import { persist, showEnd, showAch, doShare } from './game';

export function applyLang(): void {
  const L = LN();
  document.documentElement.lang = L.code;
  document.title = L.docTitle;
  $('titleH1').innerHTML = L.h1;
  document.querySelectorAll('[data-i]').forEach(el => {
    const v = L.ui[(el as HTMLElement).dataset.i as string];
    if (v === undefined) return;
    if (el.classList.contains('ih') || v.indexOf('<') >= 0) (el as HTMLElement).innerHTML = v; else (el as HTMLElement).textContent = v;
  });
  document.querySelectorAll('[data-ti]').forEach(el => {
    const v = L.ui[(el as HTMLElement).dataset.ti as string];
    if (v !== undefined) (el as HTMLElement).title = v;
  });
  ($('hint') as HTMLElement).innerHTML = L.ui.hint;
  $('keysHint').innerHTML = L.ui.keysHint;
  $('againHint').innerHTML = L.ui.againHint;
  ($('nameInput') as HTMLInputElement).placeholder = L.defName;
  document.querySelectorAll('.langBtn[data-l]').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.l === lang));
  updateSkinUI();
  import('./fx').then(m => m.updateSpotHud());
  applyVibBtn();
  if (!$('screenEnd').classList.contains('hidden')) showEnd();
}

// ---------- превью породы ----------
const pv = ($('skinPrev') as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
const pvDog = { x: 0, y: 0, vx: 0, vy: 0, a: 0, phase: 0, id: 9, sc: 1, peeing: false, excited: false, moving: true };
export function drawSkinPreview(dt: number): void {
  pvDog.phase += dt * 11;
  pv.setTransform(2, 0, 0, 2, 0, 0);
  pv.clearRect(0, 0, 104, 60);
  pv.save();
  pv.translate(44, 30);
  pv.scale(.95, .95);
  drawDog(pv, pvDog, SK());
  pv.restore();
}
export function updateSkinUI(): void {
  const s = SK(), L = LN();
  ($('skinName') as HTMLElement).textContent = L.skins[s.key].n;
  const t = $('skinSize');
  t.textContent = L.sizeDog(L.sizes[s.size]);
  t.className = 'sizeTag ' + s.size;
  ($('skinPerk') as HTMLElement).textContent = L.skins[s.key].p;
  pvDog.sc = (s.base as Record<string, number>).sc * .82;
}
export function skinShift(d: number): void {
  setSkinIdx((skinIdx + d + SKINS.length) % SKINS.length);
  updateSkinUI(); persist();
}

// ---------- вибрация-кнопка ----------
export function applyVibBtn(): void {
  import('./audio').then(a => {
    const vibBtn = $('vibBtn') as HTMLElement | null;
    if (!vibBtn) return;
    const getVibr = (window as unknown as { getVibr?: () => boolean }).getVibr;
    const on = getVibr ? getVibr() : true;
    vibBtn.textContent = on ? LN().ui.vibOn : LN().ui.vibOff;
    vibBtn.classList.toggle('on', on);
  });
}

export { drawSkinPreview as previewStep };
