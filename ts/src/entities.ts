// Сущности: игрок, Рекс, кот, Барбос, схватки, лай — перенос 1:1
import { TAU, rnd, clamp, dist, lerpAng, W, H, GW, GH, CELL, EMPTY, OWN, REX, BARB, DROP_CAP } from './types';
import { state, player, rival, cat, barb, mapGeom, D, SK, LN, diffKey, setBones, getBones, rings, parts } from './state';
import { grid, claimCircle, paintStamp, syncStamp, eraseStamp, syncErase, clearCircle, cellBlocked, collide } from './world';
import { toast, toastOnce, floater, dust, award, makeDrop, updateDrops, updateParts, captureSpot } from './fx';
import { sndBark, sndGrowl, sndYelp, sndMeow, sndJingle, sndRoar, sndFight, startPeeSnd, stopPeeSnd, sndPop, vib } from './audio';
import type { DogState } from './types';
import { input, key, joy, PAD } from './input';

const base = (): Record<string, number | boolean> => SK().base as Record<string, number | boolean>;
const n = (k: string, d = 1): number => (base()[k] as number) ?? d;

export function doBark(): void {
  const p = player, L = LN();
  if (p.barkCd > 0 || state.mode !== 'play' || p.inBrawl) return;
  p.barkCd = 5;
  const R = 130 * n('fearM');
  rings.push({ x: p.x, y: p.y, r: 16, life: .6 });
  rings.push({ x: p.x, y: p.y, r: 2, life: .7 });
  sndBark(); sndGrowl(); vib(15);
  const dp = dist(p.x, p.y, rival.x, rival.y);
  if (dp < R && rival.state !== 'flee') { rival.state = 'flee'; rival.t = 1.6; }
  if (cat.active && cat.state !== 'flee' && dist(p.x, p.y, cat.x, cat.y) < R) { cat.state = 'flee'; cat.t = 1.2; }
  if (barb.active && barb.state !== 'gone' && barb.state !== 'flee' && !barb.brawl) {
    const db = dist(p.x, p.y, barb.x, barb.y);
    if (db < R) {
      if (player.sc >= 1.15) { // крупные псы отгоняют
        barb.state = 'flee'; barb.t = 1.6; barb.goneT = 12;
        const v = award(20 * n('chasePts'));
        toast(L.tBarkBig(v), 'gold');
        sndYelp();
      } else {
        barb.attackCd = 0; // бросается сразу
        barb.state = 'chase';
        toast(L.tBarkSmall, 'red');
        sndRoar();
      }
    }
  }
}

export function updatePlayer(dt: number, mode: 'player' | 'ai' | 'off'): void {
  const p = player, B = base(), L = LN();
  let ax = 0, ay = 0, pee = false;
  if (mode === 'player') {
    ax = ((key.ArrowRight || key.KeyD) ? 1 : 0) - ((key.ArrowLeft || key.KeyA) ? 1 : 0);
    ay = ((key.ArrowDown || key.KeyS) ? 1 : 0) - ((key.ArrowUp || key.KeyW) ? 1 : 0);
    if (joy.on) { ax = joy.vx; ay = joy.vy; }
    else if (PAD.ax || PAD.ay) { ax = PAD.ax; ay = PAD.ay; }
    pee = input.space || input.btn || PAD.pee;
    if (input.bark) { input.bark = false; doBark(); }
  } else if (mode === 'ai') {
    p.aiT -= dt;
    if (p.aiPee > 0) p.aiPee -= dt;
    if (p.aiT <= 0) {
      if (p.bladder > 55 && p.aiPee <= 0) {
        p.aiPee = rnd(1, 2); p.aiT = p.aiPee + 1;
        p.tx = p.x + rnd(-40, 40); p.ty = p.y + rnd(-40, 40);
      } else {
        p.aiT = rnd(2.5, 5);
        for (let t = 0; t < 20; t++) {
          const x = rnd(100, W - 100), y = rnd(100, H - 100);
          if (!cellBlocked(x, y)) { p.tx = x; p.ty = y; break; }
        }
      }
    }
    if (p.aiPee > 0) { ax = (p.tx - p.x) * .02; ay = (p.ty - p.y) * .02; }
    else {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 24) p.aiT = Math.min(p.aiT, .4);
      ax = dx / d; ay = dy / d;
    }
    pee = p.aiPee > 0;
  }
  p.barkCd = Math.max(0, p.barkCd - dt);
  if (p.inBrawl) { // в схватке пёс занят
    stopPeeSnd();
    return;
  }
  const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
  const cap = (p.peeing ? 78 : 205) * n('spd'), k = 1 - Math.exp(-9 * dt);
  p.vx += (ax * cap - p.vx) * k; p.vy += (ay * cap - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt; collide(p, 13 * p.sc);
  const sp = Math.hypot(p.vx, p.vy);
  p.moving = sp > 20;
  if (sp > 25) p.a = lerpAng(p.a, Math.atan2(p.vy, p.vx), Math.min(1, 11 * dt));
  p.phase += sp * dt * .075;
  p.stationary = sp < 22 ? p.stationary + dt : 0;
  p.excited = mapGeom.spots.some(s => s.owner !== OWN && (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 19600);

  if (pee && p.bladder <= 0 && mode === 'player') toastOnce('empty', 4, L.tEmpty, 'slate');
  p.peeing = pee && p.bladder > 0;

  if (p.peeing) {
    p.bladder = Math.max(0, p.bladder - D().drain * n('drainM') * dt);
    if (mode === 'player') state.stats.pee += dt;
    const tD = 19 * p.sc;
    const tail = { x: p.x - Math.cos(p.a) * tD, y: p.y - Math.sin(p.a) * tD };
    p.stampT -= dt;
    if (p.stampT <= 0) {
      p.stampT = .09 * n('stampM', 1);
      const R = (18 + Math.min(1, p.stationary / 1.4) * 28) * n('markR');
      claimCircle(tail.x, tail.y, R, OWN); paintStamp(tail.x, tail.y, R, OWN); syncStamp(tail.x, tail.y, R, OWN);
    }
    p.peeTick -= dt;
    if (p.peeTick <= 0) {
      p.peeTick = .035;
      const cnt = 2 + (Math.random() < .5 ? 1 : 0);
      for (let i = 0; i < cnt && updateDropsLen() < DROP_CAP; i++) pushDrop(makeDrop(tail, p.a + Math.PI, OWN));
      startPeeSnd(); vib(12);
    }
    if (state.mode === 'play') for (const s of mapGeom.spots) {
      if (s.owner === OWN) continue;
      if (dist(tail.x, tail.y, s.x, s.y) < 58) {
        s.p1 += dt / (D().spotT * n('spotM', 1));
        if (s.p1 >= 1) captureSpot(s, OWN);
      }
      else s.p1 = Math.max(0, s.p1 - dt);
    }
  } else {
    stopPeeSnd();
    for (const s of mapGeom.spots) if (s.owner !== OWN) s.p1 = Math.max(0, s.p1 - dt);
  }
  if (!p.peeing) p.bladder = Math.min(100, p.bladder + D().regen * dt);

  if (mode === 'player' && state.mode === 'play') {
    for (const b of getBones()) {
      if (!b.on) continue;
      if (dist(p.x, p.y, b.x, b.y) < 26) {
        b.on = false; b.rt = 9;
        const v = award(25);
        p.bladder = Math.min(100, p.bladder + 35);
        floater(b.x, b.y - 18, '+' + v, '#8A5E0E');
        import('./audio').then(m => m.sndCoin());
      }
    }
    for (const w of mapGeom.bowls) {
      w.cd = Math.max(0, w.cd - dt);
      if (w.cd <= 0 && dist(p.x, p.y, w.x, w.y) < 32 && p.bladder < 99) {
        w.cd = B.bowlInstant ? 0 : 6;
        p.bladder = 100;
        import('./audio').then(m => m.sndDrink());
        toastOnce('water', 4, L.tWater, 'gold');
        for (let i = 0; i < 7; i++) parts.push({ x: w.x + rnd(-8, 8), y: w.y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-20, 20), life: .5, ml: .5, r: rnd(2, 4), col: 'rgba(255,255,255,.8)', type: 'bub' });
      }
    }
  }
  p.dustT -= dt;
  if (sp > 150 && p.dustT <= 0) {
    p.dustT = .09;
    dust(p.x - Math.cos(p.a) * 12, p.y - Math.sin(p.a) * 12, 1, 20);
  }
}

// ---------- РЕКС ----------
export function pickRivalTarget(far?: boolean): void {
  const hunt = Math.random() < D().rHunt * n('huntM');
  for (let i = 0; i < 60; i++) {
    let x: number, y: number;
    if (!far && hunt) {
      const gi = (Math.random() * GW * GH) | 0;
      if (grid[gi] !== OWN) continue;
      x = (gi % GW) * CELL + 7; y = ((gi / GW) | 0) * CELL + 7;
    } else {
      x = rnd(80, W - 80); y = rnd(80, H - 80);
      if (cellBlocked(x, y)) continue;
      if (far && Math.hypot(x - player.x, y - player.y) < 420) continue;
      if (barb.active && barb.state !== 'gone' && Math.hypot(x - barb.x, y - barb.y) < 300) continue; // держится от Барбоса подальше
    }
    rival.tx = x; rival.ty = y; return;
  }
  rival.tx = W / 2; rival.ty = H / 2;
}
export function updateRival(dt: number): void {
  const r = rival;
  if (r.inBrawl) return;
  r.fleeCd = Math.max(0, r.fleeCd - dt);
  const fear = n('fearM');
  const dp = dist(player.x, player.y, r.x, r.y);
  if (r.state !== 'flee' && dp < 92 * fear && state.mode !== 'end') {
    r.state = 'flee'; r.t = D().rFleeT * n('chaseFlee'); sndYelp();
    dust(r.x, r.y, 5);
    if (r.fleeCd <= 0 && state.mode === 'play') {
      r.fleeCd = 4;
      const v = award(15 * n('chasePts')); state.stats.chased++;
      floater(r.x, r.y - 26, '+' + v, '#B37A16');
      toastOnce('chase', 3, LN().tRexChased(v), 'gold');
    }
  }
  if (r.state === 'walk') {
    const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
    if (d < 26) {
      if (Math.random() < .6) { r.state = 'mark'; r.t = 1.35; }
      else pickRivalTarget();
    } else { r.vx = dx / d * D().rSpeed; r.vy = dy / d * D().rSpeed; }
    r.stuck = Math.hypot(r.vx, r.vy) < 15 ? r.stuck + dt : 0;
    if (r.stuck > 1.5) { pickRivalTarget(); r.stuck = 0; }
  } else if (r.state === 'mark') {
    r.t -= dt; r.vx = 0; r.vy = 0;
    const tail = { x: r.x - Math.cos(r.a) * 20, y: r.y - Math.sin(r.a) * 20 };
    r.stampT -= dt;
    if (r.stampT <= 0) { r.stampT = .09; claimCircle(tail.x, tail.y, D().rClaimR, REX); paintStamp(tail.x, tail.y, D().rClaimR + 2, REX); syncStamp(tail.x, tail.y, D().rClaimR + 2, REX); }
    r.markTick -= dt;
    if (r.markTick <= 0) {
      r.markTick = D().rMarkTick;
      for (let i = 0; i < 2 && updateDropsLen() < DROP_CAP; i++) pushDrop(makeDrop(tail, r.a + Math.PI, REX));
    }
    if (state.mode === 'play') for (const s of mapGeom.spots) {
      if (s.owner === REX) continue;
      if (dist(tail.x, tail.y, s.x, s.y) < 58) { s.p2 += dt / D().rSpotT; if (s.p2 >= 1) captureSpot(s, REX); }
      else s.p2 = Math.max(0, s.p2 - dt);
    }
    if (r.t <= 0) { pickRivalTarget(); r.state = 'walk'; }
  } else {
    r.t -= dt;
    const d = Math.max(1, dp);
    r.vx = (r.x - player.x) / d * D().rFlee; r.vy = (r.y - player.y) / d * D().rFlee;
    if (r.t <= 0) { r.state = 'walk'; pickRivalTarget(true); }
  }
  r.x += r.vx * dt; r.y += r.vy * dt; collide(r, 13);
  const sp = Math.hypot(r.vx, r.vy);
  r.moving = sp > 15;
  if (r.moving) r.a = lerpAng(r.a, Math.atan2(r.vy, r.vx), Math.min(1, 8 * dt));
  r.phase += sp * dt * .075;
}

// ---------- КОТ МУРЗИК ----------
export function resetCat(): void {
  cat.active = D().cat;
  cat.x = 830; cat.y = 120; cat.vx = cat.vy = 0; cat.state = 'walk'; cat.t = 0; cat.fleeCd = 0; cat.stuck = 0;
  for (let i = 0; i < 40; i++) {
    const x = rnd(100, W - 100), y = rnd(100, H - 100);
    if (!cellBlocked(x, y)) { cat.x = x; cat.y = y; break; }
  }
  pickCatTarget();
}
function pickCatTarget(): void {
  if (Math.random() < n('huntM')) {
    for (let i = 0; i < 80; i++) {
      const gi = (Math.random() * GW * GH) | 0;
      if (grid[gi] !== OWN) continue;
      cat.tx = (gi % GW) * CELL + 7; cat.ty = ((gi / GW) | 0) * CELL + 7; return;
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd(80, W - 80), y = rnd(80, H - 80);
    if (!cellBlocked(x, y)) { cat.tx = x; cat.ty = y; return; }
  }
  cat.tx = W / 2; cat.ty = H / 2;
}
export function updateCat(dt: number): void {
  if (!cat.active) return;
  const c = cat, fear = n('fearM');
  const dp = dist(player.x, player.y, c.x, c.y);
  if (c.state !== 'flee' && dp < 80 * fear && state.mode !== 'end') {
    c.state = 'flee'; c.t = 1.3 * n('chaseFlee'); sndMeow();
    dust(c.x, c.y, 4);
    if (c.fleeCd <= 0 && state.mode === 'play') {
      c.fleeCd = 3.5;
      const v = award(10 * n('chasePts')); state.stats.catChased++;
      floater(c.x, c.y - 24, '+' + v, '#B37A16');
      toastOnce('catchase', 3, LN().tCatChased(v), 'gold');
    }
  }
  if (c.state === 'walk') {
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 20) { c.state = 'scratch'; c.t = 1.15; c.erT = 0; }
    else { c.vx = dx / d * 118; c.vy = dy / d * 118; }
    c.stuck = Math.hypot(c.vx, c.vy) < 12 ? c.stuck + dt : 0;
    if (c.stuck > 1.5) { pickCatTarget(); c.stuck = 0; }
  } else if (c.state === 'scratch') {
    c.t -= dt; c.vx = 0; c.vy = 0; c.erT -= dt;
    if (c.erT <= 0) {
      c.erT = .13;
      const ex = c.x + Math.cos(c.a) * 15, ey = c.y + Math.sin(c.a) * 15;
      const nn = clearCircle(ex, ey, 26);
      if (nn > 0) { eraseStamp(ex, ey, 26); syncErase(ex, ey, 26); }
      if (nn === 0 && c.t < 1) c.t = 0;
    }
    if (c.t <= 0) { pickCatTarget(); c.state = 'walk'; }
  } else {
    c.t -= dt;
    const d = Math.max(1, dp);
    c.vx = (c.x - player.x) / d * 250; c.vy = (c.y - player.y) / d * 250;
    if (c.t <= 0) { c.state = 'walk'; pickCatTarget(); }
  }
  c.x += c.vx * dt; c.y += c.vy * dt; collide(c, 11);
  const sp = Math.hypot(c.vx, c.vy);
  c.moving = sp > 12;
  if (c.moving) c.a = lerpAng(c.a, Math.atan2(c.vy, c.vx), Math.min(1, 9 * dt));
  c.phase += sp * dt * .09;
}

// ---------- СХВАТКИ ----------
function startBrawl(a: DogState & { inBrawl?: boolean; brawl?: unknown }, b: DogState & { inBrawl?: boolean; brawl?: unknown }, dur: number): void {
  const bx = (a.x + b.x) / 2, by = (a.y + b.y) / 2;
  a.inBrawl = true; b.inBrawl = true;
  (a as { vx: number }).vx = 0; (a as { vy: number }).vy = 0;
  (b as { vx: number }).vx = 0; (b as { vy: number }).vy = 0;
  (a as { brawl: { other: unknown; x: number; y: number; t: number; fxT: number } | null }).brawl = { other: b, x: bx, y: by, t: dur, fxT: 0 };
  state.shake = Math.max(state.shake, 6);
  sndFight(); vib([90, 50, 90], 'heavy');
}
function resolveBrawl(src: typeof barb): void { // src — инициатор (барбос)
  const br = src.brawl; if (!br) return;
  const L = LN();
  src.brawl = null; src.inBrawl = false;
  (br.other as typeof player).inBrawl = false;
  const vsPlayer = br.other === player;
  let winnerIsBarb: boolean;
  if (vsPlayer) {
    state.stats.brawls++;
    const pWin = clamp(.2 + (player.sc - .84) / (1.22 - .84) * .55, .2, .75);
    winnerIsBarb = Math.random() > pWin;
  } else {
    winnerIsBarb = Math.random() < .8;
  }
  const loser = (winnerIsBarb ? br.other : src) as unknown as typeof player;
  const winner = (winnerIsBarb ? src : br.other) as unknown as typeof player;
  const ang = Math.atan2(loser.y - winner.y, loser.x - winner.x);
  loser.vx = Math.cos(ang) * 340; loser.vy = Math.sin(ang) * 340;
  winner.vx = -Math.cos(ang) * 120; winner.vy = -Math.sin(ang) * 120;
  for (let i = 0; i < 10; i++) parts.push({ x: br.x + rnd(-14, 14), y: br.y + rnd(-14, 14), vx: rnd(-90, 90), vy: rnd(-90, 90), life: .5, ml: .5, r: rnd(2, 4), col: '#F2C94C', type: 'star' });
  dust(br.x, br.y, 8, 70);
  if (vsPlayer) {
    if (winnerIsBarb) {
      player.bladder = Math.max(0, player.bladder - 45);
      clearCircle(player.x, player.y, 78);
      state.shake = Math.max(state.shake, 10);
      toast(L.tLoseFight, 'red');
      sndYelp();
      barb.attackCd = 7;
    } else {
      state.stats.brawlsWon++;
      const v = award(30 * n('chasePts'));
      const playerNameStr = (document.getElementById('nameInput') as HTMLInputElement).value.trim().slice(0, 12) || L.defName;
      toast(L.tWinFight(playerNameStr, v), 'gold');
      sndJingle();
      barb.state = 'flee'; barb.t = 2.2; barb.goneT = 20; barb.attackCd = 6;
    }
  } else {
    if (winnerIsBarb) {
      toast(L.tBarbVsRex, 'slate');
      rival.state = 'flee'; rival.t = 3;
    } else {
      toast(L.tRexVsBarb, 'slate');
      barb.state = 'flee'; barb.t = 1.6; barb.goneT = 14;
    }
    sndYelp();
  }
}
function updateBrawl(src: typeof barb, dt: number): void {
  const br = src.brawl; if (!br) return;
  const o = br.other as typeof player;
  src.x = br.x + Math.sin(state.time * 30) * 5;
  src.y = br.y + Math.cos(state.time * 27) * 5;
  o.x = br.x - Math.sin(state.time * 30) * 5;
  o.y = br.y - Math.cos(state.time * 27) * 5;
  src.a += dt * 10; o.a -= dt * 10;
  src.phase += dt * 24; o.phase += dt * 24;
  br.fxT -= dt;
  if (br.fxT <= 0) { br.fxT = .12; dust(br.x, br.y, 2, 60); }
  br.t -= dt;
  if (br.t <= 0) resolveBrawl(src);
}

// ---------- БАРБОС ----------
export function spawnBarb(): void {
  barb.active = true;
  const side = (Math.random() * 4) | 0;
  if (side === 0) { barb.x = rnd(W); barb.y = -30; }
  else if (side === 1) { barb.x = W + 30; barb.y = rnd(H); }
  else if (side === 2) { barb.x = rnd(W); barb.y = H + 30; }
  else { barb.x = -30; barb.y = rnd(H); }
  barb.state = 'patrol'; barb.t = 0; barb.attackCd = 2; barb.brawl = null;
  pickBarbTarget();
  sndRoar(); state.shake = Math.max(state.shake, 8); vib([120, 70, 120], 'heavy');
  toast(LN().tBarbOut, 'red');
}
function pickBarbTarget(): void {
  for (let i = 0; i < 50; i++) {
    const x = rnd(80, W - 80), y = rnd(80, H - 80);
    if (!cellBlocked(x, y)) { barb.tx = x; barb.ty = y; return; }
  }
  barb.tx = W / 2; barb.ty = H / 2;
}
export function updateBarb(dt: number): void {
  if (!barb.active) return;
  if (state.mode !== 'play' && state.mode !== 'attract') return; // в паузе/финале Барбос замирает
  const b = barb;
  if (b.state === 'gone') {
    b.goneT -= dt;
    if (b.goneT <= 0) spawnBarb();
    return;
  }
  b.attackCd = Math.max(0, b.attackCd - dt);
  if (b.brawl) { updateBrawl(b, dt); return; }
  const dp = dist(player.x, player.y, b.x, b.y);
  const chaseRange = 270;
  // Барбос против Рекса: доминант не терпит наглых
  const dr = dist(rival.x, rival.y, b.x, b.y);
  if (rival.state !== 'flee' && !rival.inBrawl && dr < 150 && b.state !== 'flee') {
    if (dr < 44) { startBrawl(b, rival, 1.7); return; }
    b.tx = rival.x; b.ty = rival.y;
  } else if (state.mode === 'play' && b.attackCd <= 0 && dp < chaseRange) {
    if (dp < 40) { startBrawl(b, player, 1.8); return; }
    b.state = 'chase';
    b.tx = player.x; b.ty = player.y;
  } else if (b.state === 'chase' && (dp > chaseRange * 1.4 || b.attackCd > 0)) {
    b.state = 'patrol'; pickBarbTarget();
  }
  if (b.state === 'patrol' || b.state === 'chase') {
    const spd = b.state === 'chase' ? 150 + (diffKey === 'hard' ? 22 : 0) : 62;
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
    if (b.state === 'patrol' && d < 24) {
      if (Math.random() < .5) { b.state = 'mark'; b.t = 1.5; }
      else pickBarbTarget();
    } else if (d > 2) { b.vx = dx / d * spd; b.vy = dy / d * spd; }
    b.stuck = Math.hypot(b.vx, b.vy) < 12 ? b.stuck + dt : 0;
    if (b.stuck > 1.6) { pickBarbTarget(); b.stuck = 0; }
  } else if (b.state === 'mark') {
    b.t -= dt; b.vx = 0; b.vy = 0;
    const tail = { x: b.x - Math.cos(b.a) * 28, y: b.y - Math.sin(b.a) * 28 };
    b.stampT -= dt;
    if (b.stampT <= 0) { b.stampT = .1; claimCircle(tail.x, tail.y, 46, BARB); paintStamp(tail.x, tail.y, 48, BARB); syncStamp(tail.x, tail.y, 48, BARB); }
    b.markTick -= dt;
    if (b.markTick <= 0) {
      b.markTick = .06;
      for (let i = 0; i < 2 && updateDropsLen() < DROP_CAP; i++) pushDrop(makeDrop(tail, b.a + Math.PI, BARB));
    }
    if (b.t <= 0) { pickBarbTarget(); b.state = 'patrol'; }
  } else if (b.state === 'flee') {
    b.t -= dt;
    const d = Math.max(1, dist(player.x, player.y, b.x, b.y));
    b.vx = (b.x - player.x) / d * 230; b.vy = (b.y - player.y) / d * 230;
    if (b.t <= 0) { b.state = 'gone'; b.goneT = b.goneT || 14; b.x = -100; b.y = -100; }
  }
  b.x += b.vx * dt; b.y += b.vy * dt; collide(b, 20);
  const sp = Math.hypot(b.vx, b.vy);
  b.moving = sp > 12;
  if (b.moving) b.a = lerpAng(b.a, Math.atan2(b.vy, b.vx), Math.min(1, 7 * dt));
  b.phase += sp * dt * .06;
}

// вспомогательные для лимита капли (возврат по ссылке из fx)
import { drops } from './state';
function pushDrop(d: ReturnType<typeof makeDrop>): void { drops.push(d) }
function updateDropsLen(): number { return drops.length }
export { updateDrops, updateParts };
