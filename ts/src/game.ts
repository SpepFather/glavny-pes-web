// Игровой цикл: старт/рестарт/финал/меню/обучение/настройки + рендер и HUD — перенос 1:1
import { W, H, TAU, GW, GH, CELL, EMPTY, OWN, REX, BARB, BLOCKED, clamp, rnd, circ, dist, $, IS_TOUCH } from './types';
import { state, setState, player, rival, cat, barb, mapGeom, SK, LN, D, diffKey, setDiffKey, mapKey, setMapKey, skinIdx as skinIdxRef, lang, SAVE, playerNameStr, setBones, getBones, clouds, drops, parts, floaters, rings, ACH, ACH_STATE, bumpRun, loadBests, getPigeons } from './state';
import { grid, counts, freeCells, blockedGrid } from './world';
import { DIFFS } from './config';
import { buildMap, computeBlocked, bakeMap, bakeTop, claimCircle, mkCloud, groundC, topC, terrC, tctx, gq, tq, kq, rebuildQ, pct } from './world';
import { updatePlayer, updateRival, updateCat, updateBarb, resetCat, pickRivalTarget, spawnBarb } from './entities';
import { updatePigeons, resetPigeons, resetBones, updateBones, drawBone, drawBowl, drawPigeon, drawSpotRings, drawSpotTops, updateDrops, updateParts, drawParts, drawDrops, drawFloaters, drawLabel, toast, toastOnce, floater, dust } from './fx';
import { drawDog, drawCat } from './sprites';
import { PAL_RIVAL, PAL_BARB, SKINS, APP_VER } from './config';
import { initAudio, stopPeeSnd, sndBark, sndEnd, toggleSound, applyMuteIcons, vib, vibr, setVibr, startMusic } from './audio';
import { pollPad, bindInput } from './input';
import { applyLang, updateSkinUI, skinShift, drawSkinPreview } from './ui';
import type { DogState } from './types';

export const cv = document.getElementById('game') as HTMLCanvasElement;
export const ctx = cv.getContext('2d', { alpha: false, powerPreference: 'high-performance' }) as CanvasRenderingContext2D;
const mmC = document.getElementById('minimap') as HTMLCanvasElement;
export const mm = mmC.getContext('2d') as CanvasRenderingContext2D;
const hud = $('hud');

// ---------- сохранение настроек ----------
export function persist(): void {
  try {
    const json = JSON.stringify({ v: 4, name: ($('nameInput') as HTMLInputElement).value.slice(0, 12), skin: skinIdxRef, diff: diffKey, map: mapKey, muted: window.__gp_muted ?? SAVE.muted, vol: window.__gp_vol ?? SAVE.vol, mvol: window.__gp_mvol ?? SAVE.mvol, vib: window.__gp_vib ?? SAVE.vib, q: window.__gp_q ?? SAVE.q, lang, tut: SAVE.tut ? 1 : 0 });
    localStorage.setItem('topdog-save', json);
  } catch (e) { /* noop */ }
}
declare global { interface Window { __gp_muted?: boolean; __gp_vol?: number; __gp_mvol?: number; __gp_vib?: boolean; __gp_q?: string; topdogBack?: () => void; topdogAutoPause?: () => void } }

export function resetWorld(): void {
  buildMap();
  computeBlocked();
  grid.set(blockedGrid as Uint8Array);
  counts.fill(0); counts[EMPTY] = freeCells;
  tctx.clearRect(0, 0, W, H);
  for (const s of mapGeom.spots) { s.owner = 0; s.p1 = 0; s.p2 = 0; s.pulse = 0; }
  Object.assign(player, { x: 150, y: 562, vx: 0, vy: 0, a: 0, sc: (SK().base as Record<string, number>).sc, bladder: 70, stationary: 0, peeing: false, aiT: 0, aiPee: 0, tx: 150, ty: 562, inBrawl: false, barkCd: 0, brawl: null });
  Object.assign(rival, { x: 1520, y: 940, vx: 0, vy: 0, a: Math.PI, state: 'walk', t: 0, fleeCd: 0, stuck: 0, peeing: false, inBrawl: false, brawl: null });
  pickRivalTarget();
  resetCat();
  Object.assign(barb, { active: false, state: 'gone', x: -100, y: -100, vx: 0, vy: 0, brawl: null, inBrawl: false, everSpawned: false, spawnT: D().barbAt || 0, attackCd: 0, goneT: 0, stuck: 0 });
  resetBones(); resetPigeons();
  for (const w of mapGeom.bowls) w.cd = 0;
  drops.length = 0; parts.length = 0; floaters.length = 0; rings.length = 0;
  state.pts = 0; state.dispPts = 0; state.timeLeft = D().time; state.warned10 = false; state.shake = 0;
  Object.assign(state.stats, { chased: 0, pigeons: 0, pee: 0, allSpots: false, catChased: 0, brawls: 0, brawlsWon: 0, spots: 0 });
  state.cam.x = player.x; state.cam.y = player.y;
  import('./fx').then(m => m.updateSpotHud());
}

let mpHook: { active: () => boolean; update: (dt: number) => void; restart: () => void } | null = null;
export function setMPHook(h: typeof mpHook): void { mpHook = h }

export function startGame(): void {
  if (mpHook && mpHook.active()) { mpHook.restart(); return; }
  initAudio();
  clearTimeout(state.showEndT as unknown as number); clearTimeout(state.barbWarnT as unknown as number); clearTimeout(state.hintT as unknown as number);
  resetWorld();
  bakeMap(); bakeTop();
  setState('play');
  $('screenTitle').classList.add('hidden');
  $('screenEnd').classList.add('hidden');
  $('screenPause').classList.add('hidden');
  hud.classList.remove('hidden');
  sndBark();
  const L = LN();
  toast(L.tStart(playerNameStr(), L.skins[SK().key].n), 'gold');
  if (D().barbAt) state.barbWarnT = setTimeout(() => { if (state.mode === 'play') toast(L.tBarbSoon, 'red') }, 8000);
  if (diffKey === 'hard') setTimeout(() => { if (state.mode === 'play') toast(L.tCatSoon, 'slate') }, 1300);
  if (!state.hintHidden) { state.hintHidden = true; state.hintT = setTimeout(() => $('hint').classList.add('hidden'), 7000); }
}

export function endGame(): void {
  if (state.mode !== 'play') return;
  setState('end'); stopPeeSnd(); sndEnd();
  state.showEndT = setTimeout(showEnd, 900);
}

export function showEnd(): void {
  const L = LN();
  const owned = mapGeom.spots.filter(s => s.owner === OWN).length, P = pct(), skin = SK();
  const mult = D().mult, bonus = Math.round(state.pts * (mult - 1)), total = state.pts + bonus;
  const bests = loadBests();
  const prevBest = bests[diffKey] || 0;
  const newRec = total > prevBest;
  if (newRec) { bests[diffKey] = total; try { localStorage.setItem('topdog-best', JSON.stringify(bests)) } catch (e) { /* noop */ } }
  if (newRec) vib([40, 60, 40, 60, 150], 'rigid');
  const dl = L.diffs[diffKey];
  bumpRun({ pct: P, spots: owned, total, diff: diffKey, rex: state.stats.chased, cat: state.stats.catChased, pigeons: state.stats.pigeons, brawlsWon: state.stats.brawlsWon });
  state.lastShare = '🐶 ' + L.h1.replace(/<[^>]*>/g, '').toUpperCase() + ' — ' + playerNameStr() + ' · ' + total + ' (' + Math.round(P) + '% ' + L.ui.stTerr + ') · ' + L.maps[mapKey] + ' · ' + dl + '\n' + location.href;
  let r = L.ranks[L.ranks.length - 1][1], s = L.ranks[L.ranks.length - 1][2];
  for (const [p, rr, ss] of L.ranks) { if (P >= p) { r = rr; s = ss; break; } }
  ($('rankTitle') as HTMLElement).textContent = r; ($('rankSub') as HTMLElement).textContent = s;
  ($('endTag') as HTMLElement).textContent = playerNameStr() + ' · ' + L.maps[mapKey] + ' · ' + L.skins[skin.key].n + ' · ' + dl;
  $('recLine').classList.toggle('on', newRec);
  if (newRec) ($('recLine') as HTMLElement).textContent = L.newRec(total);
  const rows: [string, string | number][] = [
    [L.ui.stMap, L.maps[mapKey]],
    [L.ui.stBreed, L.skins[skin.key].n + ' · ' + L.sizes[skin.size].toLowerCase()],
    [L.ui.stTerr, Math.round(P) + '%'],
    [L.ui.stSpots, owned + ' / 12'],
    [L.ui.stBase, state.pts],
    [L.bonus(mult), '+' + bonus],
    [L.ui.stTotal, total],
    [L.rec(dl), bests[diffKey] || total],
    [L.ui.stRex, state.stats.chased + ' ×'],
  ];
  if (D().barbAt) rows.push([L.ui.stBrawls, state.stats.brawls + ' (' + L.ui.stWins + ' ' + state.stats.brawlsWon + ')']);
  if (D().cat) rows.push([L.ui.stCat, state.stats.catChased + ' ×']);
  rows.push([L.ui.stPigeons, state.stats.pigeons + ' ×'], [L.ui.stPee, Math.round(state.stats.pee) + ' ' + L.ui.sec]);
  ($('statsBox') as HTMLElement).innerHTML = rows.map(([k, v]) =>
    `<div class="row${k === L.ui.stTotal ? ' total' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
  $('screenEnd').classList.remove('hidden');
}

export function pauseGame(): void {
  if (state.mode !== 'play') return;
  setState('pause'); stopPeeSnd();
  hud.classList.add('hidden');
  $('screenPause').classList.remove('hidden');
}
export function resumeGame(): void {
  if (state.mode !== 'pause') return;
  setState('play'); (window as unknown as { __gp_last: number }).__gp_last = performance.now();
  hud.classList.remove('hidden');
  $('screenPause').classList.add('hidden');
}
export function exitToMenu(): void {
  if (state.mode !== 'pause' && state.mode !== 'end') return;
  clearTimeout(state.showEndT as unknown as number); clearTimeout(state.barbWarnT as unknown as number); clearTimeout(state.hintT as unknown as number);
  stopPeeSnd(); (window as unknown as { __gp_last: number }).__gp_last = performance.now();
  resetWorld(); bakeMap(); bakeTop();
  setState('attract');
  $('screenEnd').classList.add('hidden');
  $('screenPause').classList.add('hidden');
  $('screenSet').classList.add('hidden');
  $('screenTut').classList.add('hidden');
  hud.classList.add('hidden');
  $('screenTitle').classList.remove('hidden');
}

// ---------- настройки ----------
let settingsFrom = 'title';
export function openSettings(from: string): void {
  settingsFrom = from;
  if (from === 'pause') $('screenPause').classList.add('hidden');
  $('screenSet').classList.remove('hidden');
}
export function closeSettings(): void {
  $('screenSet').classList.add('hidden');
  if (settingsFrom === 'pause') $('screenPause').classList.remove('hidden');
}

// ---------- достижения и «Поделиться» ----------
export function showAch(): void {
  const L = LN(), box = $('achList');
  const achState = ACH_STATE;
  box.innerHTML = ACH.map(a => {
    const on = !!achState[a.id], d = L.ach[a.id];
    return '<div class="achCard' + (on ? '' : ' lk') + '"><div class="achIc">' + (on ? a.ic : '🔒') +
      '</div><div><b>' + d[0] + '</b><span>' + d[1] + '</span></div></div>';
  }).join('');
  ($('statLine') as HTMLElement).textContent = L.ast((window as unknown as { __gp_runs: number }).__gp_runs || 0, 0);
  $('screenAch').classList.remove('hidden');
}
function fallbackCopy(txt: string, ok: () => void): void {
  try {
    const ta = document.createElement('textarea'); ta.value = txt;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); ok();
  } catch (e) { /* noop */ }
}
export function doShare(): void {
  const L = LN();
  const txt = state.lastShare || ('🐶 ' + L.docTitle + '\n' + location.href);
  const ok = (): void => toastOnce('share', 1, L.ui.shareOk, 'gold');
  try { if (navigator.share) { navigator.share({ title: L.docTitle, text: txt }).catch(() => { /* noop */ }); return; } } catch (e) { /* noop */ }
  try { navigator.clipboard.writeText(txt).then(ok).catch(() => fallbackCopy(txt, ok)); }
  catch (e) { fallbackCopy(txt, ok) }
}

// ---------- обучение ----------
let tutIdx = 0, tutPending = false;
const TUT_ICONS = [
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="9" fill="currentColor" stroke="none"/><path d="M32 3v7M32 54v7M3 32h7M54 32h7" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M32 6C32 6 14 28 14 41a18 18 0 0 0 36 0C50 28 32 6 32 6Z"/><rect x="8" y="55" width="48" height="4" rx="2" opacity=".45"/></svg>',
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M10 26v12h10l14 12V14L20 26H10Z" fill="currentColor" stroke="none"/><path d="M44 24a12 12 0 0 1 0 16M50 17a21 21 0 0 1 0 30"/></svg>',
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8v48"/><path d="M18 10h30l-9 11 9 11H18Z" fill="currentColor" stroke="currentColor"/></svg>',
  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="24"/><path d="M32 16v16l11 8"/><circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none"/></svg>',
];
export function tutNext(): void { tutIdx++; if (tutIdx >= LN().tut.length) finishTut(); else renderTut(); }
export function tutSkip(): void { finishTut() }
export function renderTut(): void {
  const L = LN(), step = L.tut[tutIdx], n = L.tut.length;
  $('tutIcon').innerHTML = TUT_ICONS[tutIdx] || TUT_ICONS[0];
  ($('tutStepNo') as HTMLElement).textContent = L.tutStepOf(tutIdx, n);
  ($('tutT') as HTMLElement).textContent = step.t;
  ($('tutD') as HTMLElement).innerHTML = step.d;
  const dots = $('tutDots'); dots.innerHTML = '';
  for (let i = 0; i < n; i++) { const d = document.createElement('i'); if (i === tutIdx) d.className = 'on'; dots.appendChild(d); }
  ($('btnTutNext') as HTMLElement).textContent = tutIdx < n - 1 ? L.ui.tutNext : L.ui.tutGo;
}
export function showTut(i: number): void {
  tutIdx = i || 0;
  renderTut();
  $('screenTut').classList.remove('hidden');
}
export function finishTut(): void {
  SAVE.tut = 1; persist();
  $('screenTut').classList.add('hidden');
  if (tutPending) { tutPending = false; startGame(); }
}
function skipTut(): void { finishTut() }
export function tryStart(): void {
  initAudio();
  if (!SAVE.tut && (IS_TOUCH || /Android/i.test(navigator.userAgent))) {
    tutPending = true; showTut(0); return;
  }
  startGame();
}

// привязка Android-кнопки «назад» и автопаузы
window.topdogBack = function (): void {
  if (!$('screenTut').classList.contains('hidden')) { skipTut(); return; }
  if (!$('screenSet').classList.contains('hidden')) { closeSettings(); return; }
  if (state.mode === 'play') pauseGame();
  else if (state.mode === 'pause') resumeGame();
  else if (state.mode === 'end') exitToMenu();
};
window.topdogAutoPause = function (): void { pauseGame(); };

// ---------- размер экрана и качество ----------
export function resize(): void {
  state.vw = innerWidth; state.vh = innerHeight;
  state.dpr = (window.__gp_q === 'low' || state.qMode === 'low') ? 1 : Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(state.vw * state.dpr); cv.height = Math.round(state.vh * state.dpr);
  cv.style.width = state.vw + 'px'; cv.style.height = state.vh + 'px';
}
addEventListener('resize', resize);

let fpsAvg = 60, qTimer = 0, qUpT = 0, bootChecked = false;
function tuneQuality(dt: number): void {
  const inst = dt > 0 ? 1 / dt : 60;
  fpsAvg += (inst - fpsAvg) * .08;
  qTimer += dt;
  if (qTimer < 3) return;
  if (window.__gp_q !== 'auto') return;
  qTimer = 0;
  if (!bootChecked && state.mode !== 'attract') { bootChecked = true; if (fpsAvg < 15) setQuality('low'); }
  if (state.qMode === 'high' && fpsAvg < 45) { setQuality('low'); qUpT = 0; }
  else if (state.qMode === 'low' && fpsAvg >= 57) {
    qUpT++;
    if (qUpT >= 3) { setQuality('high'); qUpT = 0; }
  } else qUpT = 0;
}
export function setQuality(m: 'low' | 'high'): void {
  state.qMode = m;
  if (m === 'low' && !gq) rebuildQ();
  resize();
}

// ---------- общий апдейт ----------
function update(dt: number): void {
  if ((window as unknown as { __mpActive?: boolean }).__mpActive) { (window as unknown as { __mpUpdate: (dt: number) => void }).__mpUpdate(dt); return; }
  state.time += dt;
  for (const c of clouds) { c.x += c.vx * dt; if (c.x > W + 320) c.x = -320; }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - 26 * dt);
  const mode = state.mode === 'play' ? 'player' : state.mode === 'attract' ? 'ai' : 'off';
  updatePlayer(dt, mode);
  if (state.mode === 'play' && D().barbAt) {
    if (!(barb as typeof barb & { everSpawned?: boolean }).everSpawned) {
      barb.spawnT -= dt;
      if (barb.spawnT <= 0) { (barb as typeof barb & { everSpawned?: boolean }).everSpawned = true; spawnBarb(); }
    }
  }
  if (state.mode !== 'end') { updateRival(dt); updateCat(dt); updateBarb(dt); }
  updatePigeons(dt);
  if (state.mode === 'play') updateBones(dt);
  updateDrops(dt); updateParts(dt);
  for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].life -= dt * .9; if (floaters[i].life <= 0) floaters.splice(i, 1); }
  for (const s of mapGeom.spots) s.pulse = Math.max(0, s.pulse - dt * 1.5);
  const tx = clamp(player.x + Math.cos(player.a) * 36, state.vw / 2, W - state.vw / 2);
  const ty = clamp(player.y + Math.sin(player.a) * 36, state.vh / 2, H - state.vh / 2);
  state.cam.x += (tx - state.cam.x) * Math.min(1, dt * 4.5);
  state.cam.y += (ty - state.cam.y) * Math.min(1, dt * 4.5);
  if (state.vw >= W) state.cam.x = W / 2; if (state.vh >= H) state.cam.y = H / 2;
  if (state.mode === 'play') {
    state.timeLeft -= dt;
    if (state.timeLeft <= 10 && !state.warned10) { state.warned10 = true; toast(LN().t10, 'slate'); }
    if (state.timeLeft <= 0) { state.timeLeft = 0; endGame(); }
  }
}

// ---------- рендер ----------
export function render(): void {
  const { vw, vh, dpr, shake, cam, qMode } = state;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#28241F'; ctx.fillRect(0, 0, vw, vh);
  const shx = (Math.random() - .5) * shake, shy = (Math.random() - .5) * shake;
  ctx.save();
  ctx.translate(Math.round(vw / 2 - cam.x + shx), Math.round(vh / 2 - cam.y + shy));
  const lowQ = qMode === 'low';
  const sx = Math.max(0, (cam.x - vw / 2) / 2), sy = Math.max(0, (cam.y - vh / 2) / 2),
    sw = Math.min(W / 2 - sx, vw + 2), sh = Math.min(H / 2 - sy, vh + 2);
  if (lowQ && gq && kq) {
    ctx.drawImage(gq, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2);
    ctx.drawImage(kq, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2);
  } else { ctx.drawImage(groundC, 0, 0); ctx.drawImage(terrC, 0, 0); }
  ctx.fillStyle = 'rgba(38,32,22,.055)';
  const vx0 = cam.x - vw / 2 - 90, vx1 = cam.x + vw / 2 + 90, vy0 = cam.y - vh / 2 - 90, vy1 = cam.y + vh / 2 + 90;
  const vis = (x: number, y: number): boolean => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  for (const c of clouds) if (vis(c.x, c.y)) for (const b of c.blobs) circ(ctx, c.x + b.dx, c.y + b.dy, b.r);
  for (const w of mapGeom.bowls) if (vis(w.x, w.y)) drawBowl(ctx, w);
  for (const b of getBones()) if (vis(b.x, b.y)) drawBone(ctx, b);
  drawSpotRings(ctx, vx0, vy0, vx1, vy1);
  for (const p of getPigeons()) if (vis(p.x, p.y)) drawPigeon(ctx, p);
  drawParts(ctx, true);
  if (cat.active && vis(cat.x, cat.y)) drawCat(ctx, cat);
  const palRival = { ...PAL_RIVAL, collar: diffKey === 'hard' ? '#C4453B' : '#4E5661' };
  if (!rival.inBrawl && vis(rival.x, rival.y)) drawDog(ctx, rival, palRival);
  if (barb.active && barb.state !== 'gone' && !barb.inBrawl && vis(barb.x, barb.y)) drawDog(ctx, barb, PAL_BARB);
  if (!player.inBrawl) drawDog(ctx, player, SK());
  drawParts(ctx, false);
  drawDrops(ctx);
  drawSpotTops(ctx, vx0, vy0, vx1, vy1);
  if (lowQ && tq) ctx.drawImage(tq, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2); else ctx.drawImage(topC, 0, 0);
  const L = LN();
  if (vis(player.x, player.y)) drawLabel(ctx, player, playerNameStr(), '#2E2A26');
  if (vis(rival.x, rival.y)) drawLabel(ctx, rival, L.rival, '#4E5661');
  if (barb.active && barb.state !== 'gone' && vis(barb.x, barb.y)) drawLabel(ctx, barb, L.barb, '#5A3A20');
  if (cat.active && vis(cat.x, cat.y)) drawLabel(ctx, cat, L.cat, '#575F6B');
  const mpRender = (window as unknown as { __mpRenderDogs?: (ctx: CanvasRenderingContext2D) => void }).__mpRenderDogs;
  if (mpRender) mpRender(ctx);
  drawFloaters(ctx);
  ctx.restore();
}

// ---------- HUD ----------
let hudTimerStr = '', hudPctStr = '', hudT = 0, mmT = 0;
function hudUpdate(dt: number): void {
  const mob = state.qMode === 'low', hudStep = .083, mmStep = .167;
  hudT += dt; mmT += dt;
  if (!mob || hudT >= hudStep) {
    hudT = 0;
    ($('bladderFill') as HTMLElement).style.width = player.bladder + '%';
    ($('bladderBar') as HTMLElement).classList.toggle('full', player.bladder > 99.5);
    const bk = 1 - player.barkCd / 5;
    ($('barkFill') as HTMLElement).style.width = (bk * 100) + '%';
    ($('barkBar') as HTMLElement).classList.toggle('full', player.barkCd <= 0);
    ($('barkBtn') as HTMLElement).classList.toggle('cd', player.barkCd > 0);
    const pStr = Math.round((window as unknown as { __mpMyPct?: number }).__mpMyPct ?? pct()) + '%';
    if (pStr !== hudPctStr) { hudPctStr = pStr; ($('terrPct') as HTMLElement).textContent = pStr; }
    const s = Math.max(0, Math.ceil(state.timeLeft));
    const tStr = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (tStr !== hudTimerStr) { hudTimerStr = tStr; ($('timer') as HTMLElement).textContent = tStr; }
    ($('timer') as HTMLElement).classList.toggle('low', state.timeLeft <= 10 && state.mode === 'play');
    state.dispPts += (state.pts - state.dispPts) * Math.min(1, dt * 10);
    if (Math.abs(state.pts - state.dispPts) < 1) state.dispPts = state.pts;
    ($('ptsVal') as HTMLElement).textContent = String(Math.round(state.dispPts));
  }
  if (!mob || mmT >= mmStep) {
    mmT = 0;
    if (mob && gq && kq) {
      mm.drawImage(gq, 0, 0, 156, 104);
      mm.drawImage(kq, 0, 0, 156, 104);
    } else {
      mm.fillStyle = '#9AB57A'; mm.fillRect(0, 0, 156, 104);
      mm.drawImage(terrC, 0, 0, 156, 104);
    }
    for (const sp of mapGeom.spots) {
      mm.fillStyle = sp.owner === OWN ? '#F2C34C' : sp.owner === REX ? '#7E8CA0' : 'rgba(46,42,38,.4)';
      mm.fillRect(sp.x / W * 156 - 1.5, sp.y / H * 104 - 1.5, 3, 3);
    }
    if (cat.active) {
      mm.fillStyle = '#D7DEE8'; circ(mm, cat.x / W * 156, cat.y / H * 104, 2.4);
      mm.strokeStyle = '#2E2A26'; mm.lineWidth = 1; mm.stroke();
    }
    if (barb.active && barb.state !== 'gone') {
      mm.fillStyle = '#7A5232'; circ(mm, barb.x / W * 156, barb.y / H * 104, 3.2);
      mm.strokeStyle = '#FBF4E2'; mm.lineWidth = 1; mm.stroke();
    }
    mm.fillStyle = '#E8A33D';
    mm.beginPath(); mm.arc(player.x / W * 156, player.y / H * 104, 3.4, 0, TAU); mm.fill();
    mm.strokeStyle = '#FBF4E2'; mm.lineWidth = 1.5; mm.stroke();
    mm.fillStyle = '#4E5661'; circ(mm, rival.x / W * 156, rival.y / H * 104, 2.6);
    const mmMP = (window as unknown as { __mpMinimap?: (mm: CanvasRenderingContext2D) => void }).__mpMinimap;
    if (mmMP) mmMP(mm);
  }
}

// ---------- цикл ----------
let last = performance.now(), pauseT = 1;
export function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  pollPad();
  tuneQuality(dt);
  if (state.mode === 'pause') { // лёгкий замороженный фон
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    pauseT += dt;
    if (pauseT >= .1) {
      pauseT = 0;
      ctx.fillStyle = '#28241F'; ctx.fillRect(0, 0, state.vw, state.vh);
      ctx.save();
      ctx.translate(Math.round(state.vw / 2 - state.cam.x), Math.round(state.vh / 2 - state.cam.y));
      if (state.qMode === 'low' && gq) {
        const sx = Math.max(0, (state.cam.x - state.vw / 2) / 2), sy = Math.max(0, (state.cam.y - state.vh / 2) / 2),
          sw = Math.min(W / 2 - sx, state.vw + 2), sh = Math.min(H / 2 - sy, state.vh + 2);
        ctx.drawImage(gq, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2);
        if (kq) ctx.drawImage(kq, sx, sy, sw, sh, sx * 2, sy * 2, sw * 2, sh * 2);
      } else { ctx.drawImage(groundC, 0, 0); ctx.drawImage(terrC, 0, 0); }
      ctx.restore();
    }
    return;
  }
  update(dt);
  render();
  hudUpdate(dt);
  if (!$('screenTitle').classList.contains('hidden')) drawSkinPreview(dt);
}
