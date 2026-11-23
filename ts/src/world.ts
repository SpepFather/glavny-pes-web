// Мир: карта, сетка владения, коллизии, запекание слоёв — перенос 1:1
import { W, H, CELL, GW, GH, EMPTY, OWN, REX, BARB, BLOCKED, rnd, circ, ell, dist } from './types';
import { MAP, mapGeom, setBones, setPigeons, state, D } from './state';
import { THEME, type House, type Tent, type Car } from './config';
import type { Rect, Circ, Spot, DogState } from './types';

// ---------- оффскрин-слои ----------
export const groundC = document.createElement('canvas'); groundC.width = W; groundC.height = H;
export const topC = document.createElement('canvas'); topC.width = W; topC.height = H;
export const terrC = document.createElement('canvas'); terrC.width = W; terrC.height = H;
export const tctx = terrC.getContext('2d') as CanvasRenderingContext2D;
export let gq: HTMLCanvasElement | null = null, tq: HTMLCanvasElement | null = null, kq: HTMLCanvasElement | null = null;

// ---------- сетка владения ----------
export const grid = new Uint8Array(GW * GH);
export let blockedGrid: Uint8Array | null = null;
export let freeCells = 0;
export const counts = [0, 0, 0, 0, 0];

export function buildMap(): void {
  const m = MAP();
  mapGeom.houses = m.houses.map(h => ({ ...h }));
  mapGeom.trees = m.trees.map(t => [...t] as [number, number, number]);
  mapGeom.bushes = m.bushes.map(b => [...b] as [number, number]);
  mapGeom.lamps = m.lamps.map(l => [...l] as [number, number]);
  mapGeom.hydrants = m.hydrants.map(h => [...h] as [number, number]);
  mapGeom.cans = m.cans.map(c => [...c] as [number, number]);
  mapGeom.benches = m.benches.map(b => [...b] as [number, number]);
  mapGeom.bowls = m.bowls.map(b => ({ x: b.x, y: b.y, cd: 0 }));
  mapGeom.rectColl = mapGeom.houses.map(h => ({ x: h.x + 4, y: h.y + 4, w: h.w - 8, h: h.h - 8 }));
  for (const b of mapGeom.benches) mapGeom.rectColl.push({ x: b[0] - 27, y: b[1] - 9, w: 54, h: 18 });
  for (const c of m.cars) mapGeom.rectColl.push({ x: c.x + 3, y: c.y + 3, w: c.w - 6, h: c.h - 6 });
  for (const t of m.tents) mapGeom.rectColl.push({ x: t.x + 4, y: t.y + 4, w: t.w - 8, h: t.h - 8 });
  const cc: Circ[] = [];
  for (const [x, y] of mapGeom.trees) cc.push({ x, y, r: 10 });
  for (const [x, y] of mapGeom.bushes) cc.push({ x, y, r: 12 });
  for (const [x, y] of mapGeom.lamps) cc.push({ x, y, r: 5.5 });
  for (const [x, y] of mapGeom.hydrants) cc.push({ x, y, r: 9.5 });
  for (const [x, y] of mapGeom.cans) cc.push({ x, y, r: 11 });
  for (const [x, y, r] of m.hay) cc.push({ x, y, r: r * .75 });
  for (const [x, y] of m.tires) cc.push({ x, y, r: 13 });
  mapGeom.circColl = cc;
  mapGeom.spots = [];
  mapGeom.hydrants.forEach(([x, y]) => mapGeom.spots.push({ x, y, kind: 'hydrant', owner: 0, p1: 0, p2: 0, pulse: 0 }));
  mapGeom.lamps.forEach(([x, y]) => mapGeom.spots.push({ x, y, kind: 'lamp', owner: 0, p1: 0, p2: 0, pulse: 0 }));
  mapGeom.cans.forEach(([x, y]) => mapGeom.spots.push({ x, y, kind: 'can', owner: 0, p1: 0, p2: 0, pulse: 0 }));
  // свободные точки для костей и голубей
  const boneSpawns: [number, number][] = [], pigeonSpawns: [number, number][] = [];
  for (let tries = 0; tries < 600 && (boneSpawns.length < 12 || pigeonSpawns.length < 9); tries++) {
    const x = rnd(90, W - 90), y = rnd(90, H - 90);
    if (cellBlockedRaw(x, y)) continue;
    if (boneSpawns.length < 12) boneSpawns.push([x, y]);
    if (pigeonSpawns.length < 9) pigeonSpawns.push([x, y]);
  }
  while (boneSpawns.length < 12) boneSpawns.push([W / 2, H / 2]);
  while (pigeonSpawns.length < 9) pigeonSpawns.push([W / 2, H / 2]);
  mapGeom.boneSpawns = boneSpawns;
  mapGeom.pigeonSpawns = pigeonSpawns;
}

export function computeBlocked(): void {
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const cx = gx * CELL + 7, cy = gy * CELL + 7; let b = false;
    if (cx < 34 || cx > W - 34 || cy < 34 || cy > H - 34) b = true;
    if (!b) for (const rc of mapGeom.rectColl) if (cx > rc.x - 12 && cx < rc.x + rc.w + 12 && cy > rc.y - 12 && cy < rc.y + rc.h + 12) { b = true; break; }
    if (!b) for (const c of mapGeom.circColl) if ((cx - c.x) ** 2 + (cy - c.y) ** 2 < (c.r + 12) ** 2) { b = true; break; }
    grid[gy * GW + gx] = b ? BLOCKED : EMPTY;
  }
  blockedGrid = grid.slice();
  freeCells = 0; for (let i = 0; i < grid.length; i++) if (grid[i] !== BLOCKED) freeCells++;
}
export function cellBlockedRaw(x: number, y: number): boolean {
  const cx = x, cy = y;
  if (cx < 44 || cx > W - 44 || cy < 44 || cy > H - 44) return true;
  for (const rc of mapGeom.rectColl) if (cx > rc.x - 12 && cx < rc.x + rc.w + 12 && cy > rc.y - 12 && cy < rc.y + rc.h + 12) return true;
  for (const c of mapGeom.circColl) if ((cx - c.x) ** 2 + (cy - c.y) ** 2 < (c.r + 12) ** 2) return true;
  return false;
}
export function cellBlocked(x: number, y: number): boolean {
  const gx = x / CELL | 0, gy = y / CELL | 0;
  if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
  return grid[gy * GW + gx] === BLOCKED;
}
export function claimCircle(x: number, y: number, r: number, owner: number): void {
  const x0 = Math.max(0, (x - r) / CELL | 0), x1 = Math.min(GW - 1, (x + r) / CELL | 0);
  const y0 = Math.max(0, (y - r) / CELL | 0), y1 = Math.min(GH - 1, (y + r) / CELL | 0);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const cx = gx * CELL + 7, cy = gy * CELL + 7;
    if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
    const i = gy * GW + gx, cur = grid[i];
    if (cur === BLOCKED || cur === owner) continue;
    counts[cur]--; counts[owner]++; grid[i] = owner;
  }
}
export function clearCircle(x: number, y: number, r: number): number { // стычка и Мурзик стирают метки игрока
  let n = 0;
  const x0 = Math.max(0, (x - r) / CELL | 0), x1 = Math.min(GW - 1, (x + r) / CELL | 0);
  const y0 = Math.max(0, (y - r) / CELL | 0), y1 = Math.min(GH - 1, (y + r) / CELL | 0);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const cx = gx * CELL + 7, cy = gy * CELL + 7;
    if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
    const i = gy * GW + gx;
    if (grid[i] === OWN) { counts[OWN]--; counts[EMPTY]++; grid[i] = EMPTY; n++; }
  }
  return n;
}
export function paintStamp(x: number, y: number, r: number, owner: number, col?: string): void {
  tctx.fillStyle = col || (owner === OWN ? '#EFC94C' : owner === REX ? '#93A5BD' : '#B08A5A');
  tctx.globalAlpha = .2; circ(tctx, x, y, r);
  if (Math.random() < .55) {
    tctx.globalAlpha = .22;
    circ(tctx, x + rnd(-r, r) * .7, y + rnd(-r, r) * .7, rnd(2, 5));
  }
  tctx.globalAlpha = 1;
}
export function eraseStamp(x: number, y: number, r: number): void {
  tctx.save();
  tctx.globalCompositeOperation = 'destination-out';
  tctx.globalAlpha = .9; circ(tctx, x, y, r);
  tctx.restore();
}
export const pct = (): number => counts[OWN] / freeCells * 100;

// ---------- столкновения ----------
export function collide(e: { x: number; y: number }, r: number): void {
  e.x = Math.max(30 + r, Math.min(W - 30 - r, e.x));
  e.y = Math.max(30 + r, Math.min(H - 30 - r, e.y));
  for (const rc of mapGeom.rectColl) {
    const nx = Math.max(rc.x, Math.min(e.x, rc.x + rc.w)), ny = Math.max(rc.y, Math.min(e.y, rc.y + rc.h));
    const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) {
        const l = e.x - rc.x, rr = rc.x + rc.w - e.x, t = e.y - rc.y, bb = rc.y + rc.h - e.y, m = Math.min(l, rr, t, bb);
        if (m === l) e.x = rc.x - r; else if (m === rr) e.x = rc.x + rc.w + r;
        else if (m === t) e.y = rc.y - r; else e.y = rc.y + rc.h + r;
      } else { const d = Math.sqrt(d2); e.x = nx + dx / d * r; e.y = ny + dy / d * r; }
    }
  }
  for (const c of mapGeom.circColl) {
    const dx = e.x - c.x, dy = e.y - c.y, rr = r + c.r, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0) { const d = Math.sqrt(d2); e.x = c.x + dx / d * rr; e.y = c.y + dy / d * rr; }
  }
}

/* ================================================================
   ЗАПЕКАНИЕ КАРТ
================================================================ */
function drawHouse(g: CanvasRenderingContext2D, h: House): void {
  g.fillStyle = 'rgba(45,38,28,.18)'; g.fillRect(h.x + 8, h.y + 10, h.w, h.h);
  g.fillStyle = h.c; g.fillRect(h.x, h.y, h.w, h.h);
  g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2; g.beginPath();
  for (let yy = h.y + 18; yy < h.y + h.h - 8; yy += 20) { g.moveTo(h.x + 8, yy); g.lineTo(h.x + h.w - 8, yy); }
  g.stroke();
  g.strokeStyle = h.r; g.lineWidth = 4; g.strokeRect(h.x + 2, h.y + 2, h.w - 4, h.h - 4);
  g.lineWidth = 5; g.beginPath(); g.moveTo(h.x + 10, h.y + h.h / 2); g.lineTo(h.x + h.w - 10, h.y + h.h / 2); g.stroke();
  if (h.shed) { // ворота сарая
    g.fillStyle = h.r; g.fillRect(h.x + h.w / 2 - 22, h.y + h.h - 38, 44, 34);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(h.x + h.w / 2, h.y + h.h - 38); g.lineTo(h.x + h.w / 2, h.y + h.h - 4); g.stroke();
  } else {
    g.fillStyle = h.r; g.fillRect(h.x + h.w - 40, h.y + 14, 24, 24);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(h.x + h.w - 36, h.y + 18, 16, 16);
  }
}
function drawTent(g: CanvasRenderingContext2D, t: Tent): void { // рыночный навес
  g.fillStyle = 'rgba(45,38,28,.18)'; g.fillRect(t.x + 8, t.y + 10, t.w, t.h);
  g.fillStyle = '#EFE7D2'; g.fillRect(t.x, t.y, t.w, t.h);
  const sw = t.w / 6;
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? t.c : '#F6F1E6'; g.fillRect(t.x + i * sw, t.y, sw, 26); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.strokeRect(t.x, t.y, t.w, 26);
  g.strokeStyle = t.c; g.lineWidth = 4; g.strokeRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4);
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(t.x + 10, t.y + 36, t.w - 20, 10);
  g.fillStyle = '#B98A54'; g.fillRect(t.x + 16, t.y + 50, 44, 26);
  g.fillRect(t.x + t.w - 60, t.y + 50, 44, 26);
}
function drawCar(g: CanvasRenderingContext2D, c: Car): void {
  g.fillStyle = 'rgba(45,38,28,.22)'; g.fillRect(c.x + 5, c.y + 7, c.w, c.h);
  const vert = c.h > c.w;
  g.fillStyle = c.c;
  if (vert) {
    g.fillRect(c.x, c.y, c.w, c.h);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(c.x + 7, c.y + 16, c.w - 14, 22); g.fillRect(c.x + 7, c.y + c.h - 52, c.w - 14, 22);
    g.fillStyle = '#33302B';
    g.fillRect(c.x - 3, c.y + 18, 6, 24); g.fillRect(c.x + c.w - 3, c.y + 18, 6, 24);
    g.fillRect(c.x - 3, c.y + c.h - 42, 6, 24); g.fillRect(c.x + c.w - 3, c.y + c.h - 42, 6, 24);
    g.fillStyle = 'rgba(255,244,200,.8)'; g.fillRect(c.x + 8, c.y + c.h - 6, c.w - 16, 4);
  } else {
    g.fillRect(c.x, c.y, c.w, c.h);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(c.x + 16, c.y + 7, 22, c.h - 14); g.fillRect(c.x + c.w - 52, c.y + 7, 22, c.h - 14);
    g.fillStyle = '#33302B';
    g.fillRect(c.x + 18, c.y - 3, 24, 6); g.fillRect(c.x + 18, c.y + c.h - 3, 24, 6);
    g.fillRect(c.x + c.w - 42, c.y - 3, 24, 6); g.fillRect(c.x + c.w - 42, c.y + c.h - 3, 24, 6);
    g.fillStyle = 'rgba(255,244,200,.8)'; g.fillRect(c.x + c.w - 6, c.y + 8, 4, c.h - 16);
  }
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2.5;
  g.strokeRect(c.x, c.y, c.w, c.h);
}
function drawHay(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = 'rgba(45,38,28,.16)'; ell(g, x + 5, y + 7, r, r * .8);
  g.fillStyle = '#D9B95C'; circ(g, x, y, r);
  g.strokeStyle = '#B4913C'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * .6, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r * .7, y - r * .3); g.lineTo(x + r * .7, y + r * .3);
  g.moveTo(x - r * .3, y - r * .7); g.lineTo(x + r * .3, y + r * .7); g.stroke();
}
function drawTire(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = 'rgba(45,38,28,.18)'; ell(g, x + 3, y + 4, 15, 12);
  g.fillStyle = '#3A3631'; circ(g, x, y, 14);
  g.fillStyle = '#57534E'; circ(g, x, y, 7);
  g.strokeStyle = '#26231F'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.stroke();
}

export function bakeMap(): void {
  const m = MAP(), th = THEME[m.theme], g = groundC.getContext('2d') as CanvasRenderingContext2D;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = th.ground; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 170; i++) {
    g.fillStyle = Math.random() < .5 ? th.grass1 : th.grass2;
    ell(g, rnd(W), rnd(H), rnd(18, 70), rnd(12, 44));
  }
  if (m.id === 'yards') {
    g.fillStyle = 'rgba(60,90,40,.05)';
    for (let x = 0; x < W; x += 240) g.fillRect(x, 0, 120, H);
    g.fillStyle = '#DACFB9';
    g.fillRect(0, 436, W, 44); g.fillRect(0, 640, W, 44);
    g.fillRect(716, 0, 44, H); g.fillRect(900, 0, 44, H);
    g.strokeStyle = 'rgba(160,146,118,.55)'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < W; x += 46) { g.moveTo(x, 436); g.lineTo(x, 480); g.moveTo(x, 640); g.lineTo(x, 684); }
    for (let y = 0; y < H; y += 46) { g.moveTo(716, y); g.lineTo(760, y); g.moveTo(900, y); g.lineTo(944, y); }
    g.stroke();
    g.fillStyle = '#6F6A64';
    g.fillRect(760, 0, 140, H); g.fillRect(0, 480, W, 160);
    g.fillStyle = 'rgba(52,48,44,.18)';
    for (let i = 0; i < 26; i++) {
      if (Math.random() < .5) ell(g, rnd(768, 892), rnd(0, H), rnd(10, 34), rnd(6, 18));
      else ell(g, rnd(0, W), rnd(488, 632), rnd(10, 34), rnd(6, 18));
    }
    g.strokeStyle = '#C7BB9F'; g.lineWidth = 3; g.beginPath();
    g.moveTo(0, 480); g.lineTo(760, 480); g.moveTo(900, 480); g.lineTo(W, 480);
    g.moveTo(0, 640); g.lineTo(760, 640); g.moveTo(900, 640); g.lineTo(W, 640);
    g.moveTo(760, 0); g.lineTo(760, 480); g.moveTo(760, 640); g.lineTo(760, H);
    g.moveTo(900, 0); g.lineTo(900, 480); g.moveTo(900, 640); g.lineTo(900, H);
    g.stroke();
    g.strokeStyle = '#E7C455'; g.lineWidth = 5; g.setLineDash([30, 26]); g.beginPath();
    g.moveTo(40, 560); g.lineTo(650, 560); g.moveTo(950, 560); g.lineTo(W - 40, 560);
    g.moveTo(830, 40); g.lineTo(830, 380); g.moveTo(830, 460); g.lineTo(830, 660);
    g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(238,231,214,.85)';
    for (let y = 490; y < 628; y += 22) g.fillRect(688, y, 46, 11);
    for (let x = 768; x < 890; x += 22) g.fillRect(x, 400, 11, 40);
    g.fillStyle = '#57534E'; circ(g, 1215, 588, 15);
    g.strokeStyle = '#48443F'; g.lineWidth = 3; g.beginPath(); g.arc(1215, 588, 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#CDBF9F';
    g.fillRect(238, 290, 26, 146); g.fillRect(240, 684, 26, 96); g.fillRect(1272, 684, 26, 81);
  } else if (m.id === 'lot') {
    // парковочная разметка
    g.strokeStyle = 'rgba(245,240,228,.75)'; g.lineWidth = 4;
    g.beginPath();
    for (let x = 150; x <= 500; x += 120) { g.moveTo(x, 180); g.lineTo(x, 400); g.moveTo(x, 740); g.lineTo(x, 960); }
    g.moveTo(1200, 180); g.lineTo(1200, 400); g.moveTo(1320, 180); g.lineTo(1320, 400); g.moveTo(1440, 180); g.lineTo(1440, 400);
    g.moveTo(1200, 740); g.lineTo(1200, 960); g.moveTo(1320, 740); g.lineTo(1320, 960); g.moveTo(1440, 740); g.lineTo(1440, 960);
    g.stroke();
    g.strokeStyle = 'rgba(245,240,228,.5)'; g.lineWidth = 5; g.setLineDash([26, 22]);
    g.beginPath(); g.moveTo(60, 560); g.lineTo(W - 60, 560); g.stroke(); g.setLineDash([]);
    // пешеходная зебра
    g.fillStyle = 'rgba(245,240,228,.8)';
    for (let x = 760; x < 920; x += 26) g.fillRect(x, 520, 14, 80);
    // масляные пятна
    for (let i = 0; i < 16; i++) {
      g.fillStyle = 'rgba(40,38,36,.16)';
      ell(g, rnd(100, 1580), rnd(140, 1000), rnd(8, 26), rnd(5, 14));
    }
    // трещины
    g.strokeStyle = 'rgba(52,48,44,.3)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      let x = rnd(W), y = rnd(H); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rnd(-40, 40); y += rnd(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
    for (const t of m.tents) drawTent(g, t);
    for (const c of m.cars) drawCar(g, c);
  } else { // dirt
    // тропинки
    g.fillStyle = 'rgba(210,186,132,.6)';
    ell(g, 840, 560, 320, 60); ell(g, 400, 900, 200, 44); ell(g, 1300, 320, 220, 48);
    // камешки и трещины
    for (let i = 0; i < 80; i++) {
      g.fillStyle = 'rgba(120,100,60,.35)'; circ(g, rnd(W), rnd(H), rnd(1.5, 3.5));
    }
    g.strokeStyle = 'rgba(120,96,56,.4)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      let x = rnd(W), y = rnd(H); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rnd(-36, 36); y += rnd(-24, 24); g.lineTo(x, y); }
      g.stroke();
    }
    // лужи-декор
    for (const [lx, ly] of [[700, 760], [1240, 540], [300, 480]] as [number, number][]) {
      g.fillStyle = 'rgba(122,152,160,.45)'; ell(g, lx, ly, 44, 20);
      g.fillStyle = 'rgba(200,220,224,.5)'; ell(g, lx - 10, ly - 4, 16, 6);
    }
  }
  for (const h of mapGeom.houses) drawHouse(g, h);
  for (const [bx, by] of mapGeom.benches) {
    g.fillStyle = 'rgba(45,38,28,.18)'; g.fillRect(bx - 25, by - 6, 54, 18);
    g.fillStyle = m.theme === 'dirt' ? '#8A7048' : '#B98A54'; g.fillRect(bx - 27, by - 9, 54, 18);
    g.strokeStyle = m.theme === 'dirt' ? '#5E4A2E' : '#8A6538'; g.lineWidth = 2; g.beginPath();
    for (let yy = by - 5; yy <= by + 7; yy += 6) { g.moveTo(bx - 25, yy); g.lineTo(bx + 25, yy); }
    g.stroke();
    g.strokeStyle = '#5E6166'; g.strokeRect(bx - 27, by - 9, 54, 18);
  }
  for (const [x, y] of mapGeom.bushes) {
    g.fillStyle = 'rgba(45,38,28,.16)'; ell(g, x + 4, y + 5, 17, 13);
    g.fillStyle = m.theme === 'dirt' ? '#9AA050' : '#7FA75D'; circ(g, x, y, 15); circ(g, x + 7, y + 3, 10);
    g.fillStyle = m.theme === 'dirt' ? '#A8AE60' : '#8FB56B'; circ(g, x - 4, y - 4, 8);
  }
  for (const [x, y, r] of m.hay) drawHay(g, x, y, r);
  for (const [x, y] of m.tires) drawTire(g, x, y);
  for (const [x, y] of mapGeom.hydrants) {
    g.fillStyle = 'rgba(45,38,28,.2)'; ell(g, x + 4, y + 5, 10, 7);
    g.fillStyle = '#A8352E'; circ(g, x + 1, y + 1, 9.5);
    g.fillStyle = '#D6483F'; circ(g, x, y, 9.5);
    g.fillStyle = '#E77A63'; circ(g, x, y, 4.6);
    g.fillStyle = '#A8352E'; circ(g, x - 8.6, y, 2.6); circ(g, x + 8.6, y, 2.6);
  }
  for (const [x, y] of mapGeom.lamps) {
    g.fillStyle = 'rgba(45,38,28,.2)'; ell(g, x + 4, y + 5, 7, 5);
    g.fillStyle = '#4A443F'; circ(g, x, y, 5.6);
    g.strokeStyle = '#332F2B'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5.6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#8A8378'; circ(g, x, y, 2.2);
  }
  for (const [x, y] of mapGeom.cans) {
    g.fillStyle = 'rgba(45,38,28,.2)'; ell(g, x + 4, y + 5, 12, 8);
    g.fillStyle = m.theme === 'dirt' ? '#8A6E4E' : '#85888D'; circ(g, x, y, 11);
    g.strokeStyle = m.theme === 'dirt' ? '#5E4A32' : '#5E6166'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.stroke();
    g.fillStyle = m.theme === 'dirt' ? '#75593C' : '#6E7176'; circ(g, x, y, 7);
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.stroke();
  }
  // растительность
  const grassCol = m.theme === 'dirt' ? '#96823E' : '#7DA055';
  for (let i = 0; i < 260; i++) {
    const x = rnd(40, W - 40), y = rnd(40, H - 40);
    if (cellBlockedRaw(x, y)) continue;
    if (Math.random() < .68) {
      g.strokeStyle = grassCol; g.lineWidth = 1.6; g.beginPath();
      g.moveTo(x - 3, y + 3); g.lineTo(x - 4, y - 4); g.moveTo(x, y + 3); g.lineTo(x, y - 5); g.moveTo(x + 3, y + 3); g.lineTo(x + 4, y - 4); g.stroke();
    } else if (m.theme !== 'asphalt') {
      g.fillStyle = Math.random() < .5 ? '#F4F1E6' : '#E9A0B0';
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; circ(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.8); }
      g.fillStyle = '#F2C94C'; circ(g, x, y, 1.4);
    }
  }
  g.fillStyle = 'rgba(255,246,214,.06)';
  for (let i = 0; i < 26; i++) circ(g, rnd(W), rnd(H), rnd(20, 60));
  // забор
  g.fillStyle = th.fence;
  g.fillRect(0, 0, W, 20); g.fillRect(0, H - 20, W, 20); g.fillRect(0, 0, 20, H); g.fillRect(W - 20, 0, 20, H);
  g.strokeStyle = th.fence2; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x < W; x += 16) { g.moveTo(x, 1); g.lineTo(x, 19); g.moveTo(x, H - 19); g.lineTo(x, H - 1); }
  for (let y = 0; y < H; y += 16) { g.moveTo(1, y); g.lineTo(19, y); g.moveTo(W - 19, y); g.lineTo(W - 1, y); }
  g.stroke();
  g.strokeStyle = th.fence2; g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4); g.strokeRect(18, 18, W - 36, H - 36);
  // тени крон
  g.fillStyle = 'rgba(45,38,28,.16)';
  for (const [x, y, r] of mapGeom.trees) ell(g, x + 10, y + 14, r * .95, r * .7);
}

export function bakeTop(): void {
  const g = topC.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, W, H);
  for (const [x, y, r] of mapGeom.trees) {
    g.fillStyle = '#6E9A50'; g.beginPath();
    g.arc(x + rnd(-5, 5), y + rnd(-5, 5), r * .9, 0, Math.PI * 2);
    g.arc(x + rnd(-7, 7), y + rnd(-7, 7), r * .72, 0, Math.PI * 2);
    g.arc(x + rnd(-7, 7), y + rnd(-7, 7), r * .6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7DAA5C'; circ(g, x - r * .18, y - r * .2, r * .55);
    g.fillStyle = 'rgba(70,100,45,.5)';
    for (let i = 0; i < 5; i++) circ(g, x + rnd(-r * .45, r * .45), y + rnd(-r * .45, r * .45), rnd(2.5, 5));
    g.strokeStyle = 'rgba(60,80,40,.28)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, r * .92, 0, Math.PI * 2); g.stroke();
  }
  if (state.qMode === 'low') rebuildQ(); // half-слои должны отражать свежезапечённую карту
}

export function mkCloud(): { x: number; y: number; vx: number; blobs: { dx: number; dy: number; r: number }[] } {
  const blobs: { dx: number; dy: number; r: number }[] = [];
  const n = (navigator.hardwareConcurrency || 8) <= 4 && ('ontouchstart' in window) ? 4 : 7;
  for (let i = 0; i < n; i++) blobs.push({ dx: rnd(-130, 130), dy: rnd(-60, 60), r: rnd(40, 85) });
  return { x: rnd(W), y: rnd(H), vx: rnd(9, 16), blobs };
}

// ---------- даунскейл-копии слоёв (для режима низкой детализации) ----------
function makeHalf(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W >> 1; c.height = H >> 1;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.imageSmoothingEnabled = true;
  g.drawImage(src, 0, 0, c.width, c.height); return c;
}
export function rebuildQ(): void { gq = makeHalf(groundC); tq = makeHalf(topC); kq = makeHalf(terrC); }
export function syncStamp(x: number, y: number, r: number, owner: number): void { // зеркальная закраска метки в half-копию слоя территории
  if (!kq) return;
  const g = kq.getContext('2d') as CanvasRenderingContext2D, h = .5;
  g.fillStyle = owner === OWN ? '#EFC94C' : owner === REX ? '#93A5BD' : '#B08A5A';
  g.globalAlpha = .2; circ(g, x * h, y * h, r * h);
  if (Math.random() < .55) {
    g.globalAlpha = .22;
    circ(g, x * h + rnd(-r, r) * .7 * h, y * h + rnd(-r, r) * .7 * h, rnd(2, 5) * h);
  }
  g.globalAlpha = 1;
}
export function syncErase(x: number, y: number, r: number): void { // зеркальное стирание из half-копии
  if (!kq) return;
  const g = kq.getContext('2d') as CanvasRenderingContext2D, h = .5;
  g.save(); g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = .9; circ(g, x * h, y * h, r * h);
  g.restore();
}
export { dist };
export type { Spot };
