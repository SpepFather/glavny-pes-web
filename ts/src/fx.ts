// Частицы, брызги, надписи, тосты, голуби, косточки, крутые места — перенос 1:1
import { TAU, rnd, dist, LOWFI, DROP_CAP, OWN, REX, ell, circ } from './types';
import { drops, parts, floaters, rings, state, player, rival, cat, barb, mapGeom, setPigeons, getPigeons, setBones, getBones, SK, LN, D } from './state';
import type { Drop, Part, Floater, Pigeon, Bone, Spot } from './types';
import { claimCircle, paintStamp, syncStamp, eraseStamp, syncErase, clearCircle } from './world';
import { sndFlap, sndPop, sndJingle, sndSteal, vib } from './audio';

// ---------- тосты ----------
const lastToast: Record<string, number> = {};
export function toast(text: string, type?: string): void {
  const toastsEl = document.getElementById('toasts') as HTMLElement;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || ''); el.textContent = text;
  toastsEl.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 350) }, 2600);
  while (toastsEl.children.length > 3) (toastsEl.firstChild as ChildNode).remove();
}
export function toastOnce(keyName: string, cd: number, text: string, type?: string): void {
  const n = performance.now();
  if (lastToast[keyName] && n - lastToast[keyName] < cd * 1000) return;
  lastToast[keyName] = n; toast(text, type);
}
export function floater(x: number, y: number, text: string, col: string): void { floaters.push({ x, y, text, col, life: 1 }); }
export function dust(x: number, y: number, n: number, spread = 40): void {
  const nn = LOWFI ? Math.ceil(n * .7) : n;
  for (let i = 0; i < nn; i++) parts.push({
    x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-spread, spread), vy: rnd(-spread, spread),
    life: rnd(.3, .5), ml: .5, r: rnd(2.5, 4.5), col: '#D9CFB6', type: 'dust',
  });
}

// ---------- очки ----------
export function award(n: number): number {
  const v = Math.round(n * ((SK().base as Record<string, number>).scoreM || 1));
  state.pts += v; return v;
}

// ---------- голуби ----------
let pid = 0;
function makePigeon(sp: [number, number]): Pigeon { return { x: sp[0], y: sp[1], a: rnd(TAU), state: 'idle', t: rnd(1, 3), fly: 0, fvx: 0, fvy: 0, id: pid++ }; }
export function resetPigeons(): void { setPigeons(mapGeom.pigeonSpawns.map(makePigeon)); }
export function updatePigeons(dt: number): void {
  const pigeons = getPigeons();
  for (const p of pigeons) {
    if (p.state === 'gone') { p.t -= dt; if (p.t <= 0) Object.assign(p, makePigeon(mapGeom.pigeonSpawns[(Math.random() * mapGeom.pigeonSpawns.length) | 0])); continue; }
    if (p.state === 'idle') {
      p.t -= dt;
      if (p.t <= 0) { p.t = rnd(.8, 2.4); p.a = rnd(TAU); }
      p.x += Math.cos(p.a) * 16 * dt; p.y += Math.sin(p.a) * 16 * dt;
      const nearP = dist(player.x, player.y, p.x, p.y) < 64,
        nearR = dist(rival.x, rival.y, p.x, p.y) < 48,
        nearC = cat.active && dist(cat.x, cat.y, p.x, p.y) < 48,
        nearB = barb.active && dist(barb.x, barb.y, p.x, p.y) < 60;
      if (nearP || nearR || nearC || nearB) {
        const src = nearP ? player : nearR ? rival : nearC ? cat : barb;
        const a = Math.atan2(p.y - src.y, p.x - src.x);
        p.state = 'fly'; p.fly = 0; p.fvx = Math.cos(a) * 135; p.fvy = Math.sin(a) * 135;
        if (nearP && state.mode === 'play') { state.stats.pigeons++; const v = award(5); floater(p.x, p.y - 16, '+' + v, '#8A7F70'); sndFlap(); }
      }
    } else {
      p.fly += dt; p.x += p.fvx * dt; p.y += p.fvy * dt;
      if (p.fly > .9) { p.state = 'gone'; p.t = rnd(5, 9); }
    }
  }
}
export function drawPigeon(g: CanvasRenderingContext2D, p: Pigeon): void {
  if (p.state === 'gone') return;
  const fly = p.state === 'fly';
  const rise = fly ? p.fly * 70 : 0, al = fly ? Math.max(0, 1 - p.fly / .9) : 1;
  const bob = fly ? 0 : Math.max(0, Math.sin(state.time * 7 + p.id)) * 1.5;
  const yy = p.y - rise - bob;
  g.save(); g.globalAlpha = al;
  g.fillStyle = 'rgba(45,38,28,.15)'; ell(g, p.x + 2, p.y + 3, 6, 4);
  if (fly) {
    const w = Math.sin(state.time * 40) * 5;
    g.fillStyle = '#8D939B';
    ell(g, p.x - 6, yy - 4 + w * .4, 6, 2.6); ell(g, p.x + 6, yy - 4 + w * .4, 6, 2.6);
  }
  g.fillStyle = '#9AA0A6'; circ(g, p.x, yy, 5.4);
  g.fillStyle = '#7C828A'; circ(g, p.x + Math.cos(p.a) * 3.4, yy + Math.sin(p.a) * 3.4, 3);
  g.fillStyle = '#E8A33D'; circ(g, p.x + Math.cos(p.a) * 6.4, yy + Math.sin(p.a) * 6.4, 1.3);
  g.restore();
}

// ---------- косточки ----------
export function resetBones(): void {
  setBones(mapGeom.boneSpawns.slice(0, 6).map(([x, y]) => ({ x, y, rot: rnd(TAU), on: true, rt: 0 })));
}
export function updateBones(dt: number): void {
  const bones = getBones();
  for (const b of bones) {
    b.rot += dt * .6;
    if (b.on) continue;
    b.rt -= dt;
    if (b.rt <= 0) {
      let ok = false;
      for (let t = 0; t < 12; t++) {
        const sp = mapGeom.boneSpawns[(Math.random() * mapGeom.boneSpawns.length) | 0];
        if (bones.some(o => o.on && o.x === sp[0] && o.y === sp[1])) continue;
        if (Math.hypot(sp[0] - player.x, sp[1] - player.y) < 250) continue;
        b.x = sp[0]; b.y = sp[1]; b.on = true; ok = true; break;
      }
      if (!ok) b.rt = 3;
    }
  }
}
export function drawBone(g: CanvasRenderingContext2D, b: Bone): void {
  if (!b.on) return;
  const bob = Math.sin(state.time * 3 + b.x) * 2;
  g.fillStyle = 'rgba(45,38,28,.15)'; ell(g, b.x + 2, b.y + 4, 10, 4);
  g.save(); g.translate(b.x, b.y + bob); g.rotate(b.rot);
  g.fillStyle = '#F6F1E2';
  g.beginPath();
  g.arc(-8, -3.2, 3.6, 0, TAU); g.arc(-8, 3.2, 3.6, 0, TAU);
  g.arc(8, -3.2, 3.6, 0, TAU); g.arc(8, 3.2, 3.6, 0, TAU);
  g.fill();
  g.fillRect(-8, -3.4, 16, 6.8);
  g.strokeStyle = 'rgba(140,125,95,.5)'; g.lineWidth = 1.5; g.strokeRect(-8, -3.4, 16, 6.8);
  g.restore();
}
export function drawBowl(g: CanvasRenderingContext2D, w: { x: number; y: number; cd: number }): void {
  g.fillStyle = 'rgba(45,38,28,.15)'; ell(g, w.x + 2, w.y + 3, 13, 8);
  g.fillStyle = '#B4713F'; circ(g, w.x, w.y, 12);
  g.strokeStyle = '#7E4A28'; g.lineWidth = 2; g.beginPath(); g.arc(w.x, w.y, 12, 0, TAU); g.stroke();
  if (w.cd <= 0) {
    g.fillStyle = '#7FB3CF'; circ(g, w.x, w.y, 8);
    g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, w.x - 3, w.y - 3, 3, 2);
  } else { g.fillStyle = '#D8C6A8'; circ(g, w.x, w.y, 8); }
}

// ---------- крутые места ----------
export function spotLabel(s: Spot): string { return LN().spots[s.kind]; }
export function updateSpotHud(): void {
  (document.getElementById('spotCnt') as HTMLElement).textContent = String(mapGeom.spots.filter(s => s.owner === OWN).length) + '/12';
}
export function captureSpot(s: Spot, who: number): void {
  const prev = s.owner, L = LN();
  s.owner = who; s.p1 = 0; s.p2 = 0; s.pulse = 1;
  if (who === OWN) {
    const v = award(prev === REX ? 75 : 50);
    state.stats.spots = (state.stats.spots || 0) + 1;
    floater(s.x, s.y - 30, '+' + v, '#8A5E0E');
    sndPop(); state.shake = Math.max(state.shake, 5); vib(25);
    toast(prev === REX ? L.tSpotRex(v) : L.tSpotNew(spotLabel(s), v), 'gold');
    if (mapGeom.spots.every(o => o.owner === OWN) && !state.stats.allSpots) {
      state.stats.allSpots = true;
      const v2 = award(200); sndJingle(); vib(18);
      toast(L.tAllSpots(v2), 'gold');
    }
  } else {
    toast(L.tRexStole(spotLabel(s)), 'slate'); sndSteal(); vib(60, 'heavy'); state.shake = Math.max(state.shake, 3);
  }
  updateSpotHud();
}
export function drawSpotRings(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  for (const s of mapGeom.spots) {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    const col = s.owner === OWN ? '#E9A93B' : s.owner === REX ? '#7E8CA0' : 'rgba(46,42,38,.35)';
    g.strokeStyle = col; g.lineWidth = 2.5; g.setLineDash([7, 6]);
    g.beginPath(); g.arc(s.x, s.y, 22, 0, TAU); g.stroke(); g.setLineDash([]);
    if (s.owner === 0 && s.p1 > 0) {
      g.strokeStyle = '#E9A93B'; g.lineWidth = 4.5;
      g.beginPath(); g.arc(s.x, s.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, s.p1)); g.stroke();
    }
    if (s.owner === 0 && s.p2 > 0) {
      g.strokeStyle = '#7E8CA0'; g.lineWidth = 4.5;
      g.beginPath(); g.arc(s.x, s.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, s.p2)); g.stroke();
    }
    if (s.pulse > 0) {
      g.globalAlpha = s.pulse;
      g.strokeStyle = s.owner === OWN ? '#F2C94C' : '#93A5BD'; g.lineWidth = 3;
      g.beginPath(); g.arc(s.x, s.y, 22 + (1 - s.pulse) * 26, 0, TAU); g.stroke();
      g.globalAlpha = 1;
    }
  }
}
export function drawSpotTops(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  for (const s of mapGeom.spots) {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    if (s.owner === OWN) {
      const bob = Math.sin(state.time * 3 + s.x * .01) * 2;
      g.save(); g.translate(s.x, s.y - 26 + bob);
      g.fillStyle = '#F2C34C'; g.strokeStyle = '#8A5E0E'; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-8, 4); g.lineTo(-8, -4); g.lineTo(-3.4, -.5); g.lineTo(0, -6); g.lineTo(3.4, -.5); g.lineTo(8, -4); g.lineTo(8, 4);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (s.owner === REX) {
      g.save(); g.translate(s.x, s.y - 26);
      g.fillStyle = '#7E8CA0'; g.strokeStyle = '#4E5661'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, 7.5, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#FBF4E2'; g.font = '800 10px Comfortaa';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', 0, .5);
      g.restore();
    }
  }
}

// ---------- частицы / брызги / надписи ----------
export function makeDrop(tail: { x: number; y: number }, baseAng: number, owner: number): Drop {
  const ang = baseAng + rnd(-1.1, 1.1), sp = rnd(110, 230), life = rnd(.26, .44);
  return {
    x: tail.x, y: tail.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, ml: life, r: rnd(2, 3.2),
    col: owner === OWN ? '#F3D75E' : owner === REX ? '#C4CEDC' : '#C9A97E', owner,
  };
}
export function updateDrops(dt: number): void {
  const mr = (SK().base as Record<string, number>).markR;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt;
    const dm = Math.exp(-2.2 * dt); d.vx *= dm; d.vy *= dm;
    if (d.life <= 0) {
      drops.splice(i, 1);
      const r = rnd(7, 13) * (d.owner === OWN ? mr : 1);
      claimCircle(d.x, d.y, r, d.owner);
      paintStamp(d.x, d.y, r + 2, d.owner); syncStamp(d.x, d.y, r + 2, d.owner);
    }
  }
}
export function updateParts(dt: number): void {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt; r.r += 260 * dt;
    if (r.life <= 0) rings.splice(i, 1);
  }
}
export function drawParts(g: CanvasRenderingContext2D, dustPass: boolean): void {
  for (const p of parts) {
    if ((p.type === 'dust') !== dustPass) continue;
    const k = p.life / p.ml;
    g.globalAlpha = k * (p.type === 'dust' ? .5 : .85);
    g.fillStyle = p.col;
    const grow = p.type === 'dust' ? 5 : p.type === 'bub' ? 6 : p.type === 'star' ? -1 : 0;
    circ(g, p.x, p.y, Math.max(.5, p.r + (1 - k) * grow));
  }
  g.globalAlpha = 1;
  for (const r of rings) { // волны лая
    g.globalAlpha = r.life * .5;
    g.strokeStyle = '#D97B4A'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
  }
  g.globalAlpha = 1;
}
export function drawDrops(g: CanvasRenderingContext2D): void {
  for (const d of drops) {
    g.globalAlpha = Math.min(1, d.life / d.ml * 1.6);
    g.fillStyle = d.col; circ(g, d.x, d.y, d.r);
  }
  g.globalAlpha = 1;
}
export function drawFloaters(g: CanvasRenderingContext2D): void {
  g.font = '800 15px Comfortaa'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const f of floaters) {
    const k = 1 - f.life, y = f.y - k * 30;
    g.globalAlpha = Math.min(1, f.life * 1.6);
    g.lineWidth = 4; g.strokeStyle = 'rgba(251,244,226,.9)'; g.strokeText(f.text, f.x, y);
    g.fillStyle = f.col; g.fillText(f.text, f.x, y);
  }
  g.globalAlpha = 1;
}
export function drawLabel(g: CanvasRenderingContext2D, d: { x: number; y: number; sc?: number }, text: string, col: string): void {
  g.font = '800 11px Comfortaa'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const y = d.y - (24 + 10 * (d.sc || 1));
  g.lineWidth = 3.5; g.strokeStyle = 'rgba(251,244,226,.92)'; g.strokeText(text, d.x, y);
  g.fillStyle = col; g.fillText(text, d.x, y);
}
export { DROP_CAP };
