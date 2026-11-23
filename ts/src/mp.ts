// Мультиплеер-клиент (3 пса, WSS-комнаты) — перенос 1:1 с game-mp.js
import { W, H, GW, GH, CELL, TAU, BLOCKED, OWN, REX, rnd, clamp, dist, lerpAng, $, LOWFI } from './types';
import { state, setState, player, rival, cat, barb, mapGeom, SK, SKINS, LN, lang, playerNameStr, skinIdx, setBones, getBones } from './state';
import { buildMap, computeBlocked, bakeMap, bakeTop, blockedGrid, paintStamp, eraseStamp } from './world';
import { rings, parts, floaters, drops } from './state';
import { toast, toastOnce, floater, dust, drawLabel, drawParts, updateParts } from './fx';
import { drawDog } from './sprites';
import { initAudio, sndBark, sndYelp, sndMeow, sndCoin, sndDrink, sndJingle, sndRoar, sndFight, sndEnd, stopPeeSnd, vib } from './audio';
import { IS_DISCORD, TMA } from './platform';
import { persist } from './game';
import type { DogState } from './types';

interface MPL10n {
  t1: string; t2: string; place: (m: number) => string;
  wait: string; start: string; inv: (c: string, l: string) => string;
  join: (s: string) => string; left: (s: string) => string; copied: string;
  full: string; bad: string; down: string; disc: string; you: string; mpT: string;
  st1: string; st2: string; st3: string; syncErr: string;
}
const MPL: Record<string, MPL10n> = {
  ru: {
    t1: 'ГЛАВНЫЙ ПЁС ДВОРА!', t2: 'победа!', place: m => m === 1 ? '1-Е МЕСТО' : m === 2 ? '2-Е МЕСТО' : '3-Е МЕСТО',
    wait: 'ждём вожака…', start: 'вожак начал игру', inv: (c, l) => 'МЕТЬ СО МНОЙ! 🐶 Код: ' + c + '\n→ @glavny_pes_bot → кнопка МЕНЮ → С ДРУЗЬЯМИ → ВВОД КОДА' + (l ? '\n' + l : ''),
    join: s => s + ' вступил в драку!', left: s => s + ' убежал по делам', copied: 'Скопировано в буфер!',
    full: 'КОМНАТА ПОЛНА (макс 3 пса)', bad: 'нет такой комнаты', down: 'сервер недоступен — проверь сеть',
    disc: 'связь оборвалась', you: 'Ты', mpT: 'МУЛЬТИПЛЕЕР', st1: 'место', st2: 'территория', st3: 'очки',
    syncErr: 'сбой кадра синхронизации',
  },
  en: {
    t1: 'TOP DOG OF THE BLOCK!', t2: 'victory!', place: m => m === 1 ? '1ST PLACE' : m === 2 ? '2ND PLACE' : '3RD PLACE',
    wait: 'waiting for the host…', start: 'host started the game', inv: (c, l) => 'MARK WITH ME! 🐶 Code: ' + c + '\n→ @glavny_pes_bot → MENU button → WITH FRIENDS → enter code' + (l ? '\n' + l : ''),
    join: s => s + ' joined the fight!', left: s => s + ' ran off on errands', copied: 'Copied!',
    full: 'ROOM IS FULL (3 dogs max)', bad: 'no such room', down: 'server unreachable — check network',
    disc: 'connection lost', you: 'You', mpT: 'MULTIPLAYER', st1: 'place', st2: 'territory', st3: 'points',
    syncErr: 'sync frame hiccup',
  },
  zh: {
    t1: '街区狗王！', t2: '胜利！', place: m => m === 1 ? '第 1 名' : m === 2 ? '第 2 名' : '第 3 名',
    wait: '等待房主…', start: '房主已开始游戏', inv: (c, l) => '一起来占地盘！🐶 房间码: ' + c + '\n→ @glavny_pes_bot → 菜单按钮 → 好友对战 → 输入房间码' + (l ? '\n' + l : ''),
    join: s => s + ' 参战了！', left: s => s + ' 先走一步', copied: '已复制！',
    full: '房间已满（最多 3 条狗）', bad: '没有这个房间', down: '服务器不可达 — 检查网络',
    disc: '连接中断', you: '你', mpT: '多人对战', st1: '名次', st2: '领地', st3: '分数',
    syncErr: '同步帧小故障',
  },
  es: {
    t1: '¡PERRO JEFE DEL BARRIO!', t2: '¡victoria!', place: m => m === 1 ? '1.er PUESTO' : m === 2 ? '2.º PUESTO' : '3.er PUESTO',
    wait: 'esperando al anfitrión…', start: 'el anfitrión empezó', inv: (c, l) => '¡MARCA CONMIGO! 🐶 Código: ' + c + '\n→ @glavny_pes_bot → botón MENÚ → CON AMIGOS → introduce el código' + (l ? '\n' + l : ''),
    join: s => s + ' se unió a la pelea!', left: s => s + ' se fue de recado', copied: '¡Copiado!',
    full: 'SALA LLENA (máx. 3 perros)', bad: 'sala inexistente', down: 'servidor inaccesible — revisa la red',
    disc: 'conexión perdida', you: 'Tú', mpT: 'MULTIJUGADOR', st1: 'puesto', st2: 'territorio', st3: 'puntos',
    syncErr: 'fallo puntual de sincronización',
  },
};
const MP_T: Record<string, Record<string, string> | ((n: string) => Record<string, string>)> = {
  hostCode: { ru: 'код комнаты — отправь его друзьям', en: 'room code — send it to friends', zh: '房间码 — 发给朋友', es: 'código de sala — envíalo a tus amigos' },
  code: { ru: 'код комнаты', en: 'room code', zh: '房间码', es: 'código de sala' },
  water: { ru: 'ВОДА! ПУЗЫРЬ ПОЛОН', en: 'WATER! BLADDER FULL', zh: '喝水！膀胱满了', es: '¡AGUA! VEJIGA LLENA' },
  chase: { ru: 'РЕКС ПРОГНАН!', en: 'REX CHASED OFF!', zh: '赶走了雷克斯！', es: '¡REX AHUYENTADO!' },
  barbIn: { ru: 'БАРБОС ВЫШЕЛ НА ОХОТУ!', en: 'BARBOS IS ON THE HUNT!', zh: '巴博斯出来打猎了！', es: '¡BARBOS SALIÓ DE CAZA!' },
  barkBig: { ru: 'БАРБОС ОШЕЛОМЛЁН ДЕРЗОСТЬЮ!', en: 'BARBOS IS STUNNED BY THE NERVE!', zh: '巴博斯被吓住了！', es: '¡BARBOS ATÓNITO ANTE TANTA CARA DURA!' },
  barkSmall: { ru: 'БАРБОСА НЕ ИСПУГАТЬ! БЕГИ!', en: 'CANNOT SCARE BARBOS! RUN!', zh: '吓不跑巴博斯！快跑！', es: '¡A BARBOS NO SE ASUSTA! ¡CORRE!' },
};
function mpT(k: string, n?: string): string {
  const v = MP_T[k] as Record<string, string> | ((n: string) => Record<string, string>) | undefined;
  if (!v) return n ? n + '!' : '';
  if (typeof v === 'function') return (v(n || ''))[lang] || n + ' SPOT!';
  return v[lang] || v.ru;
}
function mpTF(k: 'spot' | 'scat', n: string): string {
  if (k === 'spot') return ({ ru: n + ' ЗАХВАТИЛ КРУТОЕ МЕСТО!', en: n + ' CAPTURED A COOL SPOT!', zh: n + ' 占领了一个酷点！', es: '¡' + n + ' CAPTURÓ UN SITIO GENIAL!' } as Record<string, string>)[lang] || n + ' SPOT!';
  return ({ ru: 'БАРБОС ПОТРЕПАЛ: ' + n + '!', en: 'BARBOS MAULED: ' + n + '!', zh: '巴博斯撕咬了：' + n + '！', es: '¡BARBOS ZARANDEÓ A ' + n + '!' } as Record<string, string>)[lang] || ('BARBOS: ' + n + '!');
}
function esc(s: string): string { return ('' + s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
const SKBASEC = [{ sc: .84 }, { sc: .84 }, { sc: .84 }, { sc: 1 }, { sc: 1 }, { sc: 1 }, { sc: 1.22 }, { sc: 1.22 }, { sc: 1.22 }];

export interface RemoteDog { seat: number; name: string; skin: number; dog: DogState & { tx: number; ty: number; ta: number; tph: number; mv: boolean; missT?: number; vx2?: never; vy2?: never }; missT?: number }
export interface MPPlayer { seat: number; name: string; skin: number; host?: boolean }
interface SnapMsg {
  t: string; seat?: number; phase?: string; map?: string; diff?: string; players?: (MPPlayer | null)[];
  standings?: { seat: number; name: string; pct: number; pts: number }[];
  tm?: number; pts?: number[]; pct?: number[]; sp?: [number, number[]][]; bo?: number[];
  s?: Record<number, number[]>; r?: number[]; b?: number[]; c?: number[];
  ev?: unknown[][]; bn?: [number, number][]; msg?: string;
}
const COL: Record<number, string> = { 1: '#EFC94C', 2: '#7EC4E8', 3: '#E88A6A', 4: '#93A5BD', 5: '#B08A5A' };
const SEATPAL: (string | null)[] = [null, '#EFC94C', '#7EC4E8', '#E88A6A'];

export const MP = {
  BASE: IS_DISCORD ? ('wss://' + location.host) : 'wss://glavny-pes.glavny-pes.workers.dev',
  active: false, inGame: false, ws: null as WebSocket | null, seat: -1, code: '', isHost: false,
  map: 'yards', diff: 'normal',
  players: [] as (MPPlayer | null)[],
  grid: null as Uint8Array | null, counts: null as number[] | null, freeCells: 1, myPct: 0,
  remotes: [] as RemoteDog[], snapS: null as SnapMsg | null,
  myInp: { ax: 0, ay: 0, p: 0, b: 0 }, inTimer: null as ReturnType<typeof setInterval> | null,
  phase: '' as string,
  npcT: { r: null as { x: number; y: number; a: number; st: string; mv: boolean; ph: number } | null, b: null as { x: number; y: number; a: number; st: string; mv: boolean; ph: number } | null, c: null as { x: number; y: number; a: number; st: string; mv: boolean; ph: number } | null },
  boardT: 0, stunT: 0, brawlFx: null as { x: number; y: number; t: number; fxT: number } | null,
  mpEnd: false, lastStandings: null as { seat: number; name: string; pct: number; pts: number }[] | null,
  TT(): MPL10n { return MPL[lang] || MPL.ru },

  mapOwner(o: number): number { return o >= 4 ? (o === 4 ? REX : 3) : o + 4 },

  resetGrid(): void {
    this.grid = new Uint8Array(GW * GH); this.grid.set(blockedGrid as Uint8Array);
    this.counts = new Array(8).fill(0); this.freeCells = 0;
    for (let i = 0; i < this.grid.length; i++) {
      const v = this.grid[i];
      if (v === BLOCKED) (this.counts as number[])[BLOCKED]++; else { (this.counts as number[])[0]++; this.freeCells++; }
    }
  },
  claim(x: number, y: number, r: number, sv: number): void {
    const lo = this.mapOwner(sv);
    const x0 = Math.max(0, (x - r) / CELL | 0), x1 = Math.min(GW - 1, (x + r) / CELL | 0);
    const y0 = Math.max(0, (y - r) / CELL | 0), y1 = Math.min(GH - 1, (y + r) / CELL | 0);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const cx = gx * CELL + 7, cy = gy * CELL + 7;
      if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
      const i = gy * GW + gx, cur = (this.grid as Uint8Array)[i];
      if (cur === BLOCKED || cur === lo) continue;
      (this.counts as number[])[cur]--; (this.counts as number[])[lo]++; (this.grid as Uint8Array)[i] = lo;
    }
    paintStamp(x, y, r, 0, COL[sv] || '#B08A5A');
  },
  erase(x: number, y: number, r: number): void {
    const x0 = Math.max(0, (x - r) / CELL | 0), x1 = Math.min(GW - 1, (x + r) / CELL | 0);
    const y0 = Math.max(0, (y - r) / CELL | 0), y1 = Math.min(GH - 1, (y + r) / CELL | 0);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const cx = gx * CELL + 7, cy = gy * CELL + 7;
      if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
      const i = gy * GW + gx, cur = (this.grid as Uint8Array)[i];
      if (cur >= 5 && cur <= 7) { (this.counts as number[])[cur]--; (this.counts as number[])[0]++; (this.grid as Uint8Array)[i] = 0; }
    }
    eraseStamp(x, y, r);
  },

  openLobby(): void {
    initAudio();
    $('screenTitle').classList.add('hidden');
    const ach = $('screenAch'); if (ach) ach.classList.add('hidden');
    $('screenSet').classList.add('hidden');
    $('screenLobby').classList.remove('hidden');
    $('lobbyHome').classList.remove('hidden');
    $('lobbyRoom').classList.add('hidden');
    ($('lobbyStatus') as HTMLElement).textContent = '';
  },
  closeLobby(toTitle: boolean): void {
    $('screenLobby').classList.add('hidden');
    if (toTitle) $('screenTitle').classList.remove('hidden');
  },
  status(t: string): void { ($('lobbyStatus') as HTMLElement).textContent = t || ''; },
  async create(): Promise<void> {
    this.status('…');
    try {
      const r = await fetch(this.BASE.replace('wss', 'https') + '/api/room', { method: 'POST' });
      const d = await r.json() as { ok?: boolean; code?: string };
      if (!d.ok) { this.status(this.TT().down); return }
      this.join(d.code as string);
    } catch (e) { this.status(this.TT().down) }
  },
  join(code: string): void {
    code = ('' + code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) { this.status(this.TT().bad); return }
    if (this.ws) { try { this.ws.close() } catch (e) { /* noop */ } }
    this.code = code; this.status('…');
    let opened = false;
    try { this.ws = new WebSocket(this.BASE + '/api/room/' + code + '/ws') } catch (e) { this.status(this.TT().down); return }
    this.ws.onopen = () => {
      opened = true;
      (this.ws as WebSocket).send(JSON.stringify({ t: 'hi', name: playerNameStr(), skin: skinIdx }));
    };
    this.ws.onmessage = e => this.onMsg(JSON.parse(e.data) as SnapMsg);
    this.ws.onclose = () => {
      if (this.inGame) { this.toastDisc(); return }
      this.status(opened ? this.TT().bad : this.TT().down);
    };
    this.ws.onerror = () => { if (!opened) this.status(this.TT().down) };
  },
  onMsg(m: SnapMsg): void {
    if (m.t === 'hello') { this.seat = m.seat as number; this.isHost = false; (this as { phase: string }).phase = m.phase as string; this.map = m.map || 'yards'; this.diff = m.diff || 'normal'; this.showRoom(); }
    else if (m.t === 'lobby') {
      this.players = m.players as (MPPlayer | null)[]; (this as { phase: string }).phase = m.phase as string; this.map = m.map || 'yards'; this.diff = m.diff || 'normal';
      const me = (this.players as (MPPlayer | null)[]).find(p => p && p.seat === this.seat);
      this.isHost = !!(me && me.host);
      if (!$('screenLobby').classList.contains('hidden')) this.renderLobby();
    }
    else if (m.t === 'start') this.onStart(m);
    else if (m.t === 'snap') this.onSnap(m);
    else if (m.t === 'end') this.onEnd(m);
    else if (m.t === 'err') { console.error('MP server:', m.msg); toastOnce('mperr', 8, this.TT().syncErr, 'slate'); }
    else if (m.t === 'busy') { this.status(this.TT().full); try { (this.ws as WebSocket).close() } catch (e) { /* noop */ } }
  },
  showRoom(): void {
    $('lobbyHome').classList.add('hidden');
    $('lobbyRoom').classList.remove('hidden');
    ($('codeBig') as HTMLElement).textContent = this.code;
    this.renderLobby();
  },
  renderLobby(): void {
    const M = (this.players as (MPPlayer | null)[]).filter(Boolean) as MPPlayer[];
    const LNn = LN();
    const box = $('lobbyPlayers');
    box.innerHTML = M.map(p => {
      const nm = p.seat === this.seat ? p.name + ' (' + this.TT().you + ')' : p.name;
      const skn = ((SKINS[p.skin] && LNn.skins[SKINS[p.skin].key]) || {} as { n?: string }).n || '';
      return '<div class="lobbyRow"><span class="who"><span class="dot" style="background:' +
        (SEATPAL[p.seat + 1] || '#EFC94C') + '"></span>' + esc(nm) + (p.host ? ' 🏁' : '') + '</span><b>' + esc(skn) + '</b></div>';
    }).join('');
    ($('lobbyMapName') as HTMLElement).textContent = (LNn.maps && LNn.maps[this.map]) || this.map;
    ($('lobbyDiffName') as HTMLElement).textContent = (LNn.diffs && LNn.diffs[this.diff]) || this.diff;
    $('hostCtls').classList.toggle('hidden', !this.isHost);
    ($('btnLobbyStart') as HTMLElement).style.display = this.isHost ? '' : 'none';
    ($('codeHint') as HTMLElement).textContent = this.isHost ? mpT('hostCode') : mpT('code');
    document.querySelectorAll('.lobMapBtn').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.m === this.map));
    document.querySelectorAll('.lobDiffBtn').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.d === this.diff));
    this.status(M.length < 2 ? this.TT().wait : '');
  },
  sendLobbySet(): void {
    if (!this.isHost) return;
    this.wsSend({ t: 'set', map: this.map, diff: this.diff });
  },
  startMatch(): void {
    if (!this.isHost) return;
    this.wsSend({ t: 'start', map: this.map, diff: this.diff });
  },
  restart(): void {
    if (this.isHost) this.wsSend({ t: 'r' });
    else toast(this.TT().wait, 'slate');
  },
  wsSend(o: Record<string, unknown>): void { if (this.ws && this.ws.readyState === 1) try { this.ws.send(JSON.stringify(o)) } catch (e) { /* noop */ } },

  onStart(m: SnapMsg): void {
    (window as unknown as { __mp_setMapKey?: (k: string) => void }).__mp_setMapKey?.(m.map as string);
    (window as unknown as { __mp_setDiffKey?: (k: string) => void }).__mp_setDiffKey?.(m.diff as string);
    persist();
    this.mpEnd = false;
    buildMap(); computeBlocked(); bakeMap(); bakeTop();
    this.resetGrid();
    this.active = true; this.inGame = true; this.stunT = 0; this.brawlFx = null;
    (window as unknown as { __mp_resetWorld?: () => void }).__mp_resetWorld?.();
    setBones((m.bn as [number, number][]).map(([x, y]) => ({ x, y, rot: 0, on: true, rt: 0 })));
    const SP: [number, number][] = [[150, 562], [1520, 940], [1520, 180]];
    const sp = SP[this.seat] || [150, 562];
    Object.assign(player, { x: sp[0], y: sp[1], vx: 0, vy: 0, a: 0, sc: (SK().base as Record<string, number>).sc, bladder: 70, stationary: 0, peeing: false, stampT: 0, peeTick: 0, dustT: 0, moving: false, inBrawl: false, barkCd: 0 });
    this.remotes = (this.players as (MPPlayer | null)[]).filter(Boolean).map(p => p as MPPlayer).filter(p => p.seat !== this.seat).map(p => ({
      seat: p.seat, name: p.name, skin: p.skin,
      dog: { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, a: 0, ta: 0, phase: 0, tph: 0, sc: (SKBASEC[p.skin] as { sc: number }).sc, peeing: false, moving: true, excited: false, id: p.seat + 1, mv: false } as RemoteDog['dog'],
    }));
    this.npcT = { r: null, b: null, c: null };
    rival.x = 900; rival.y = 300; rival.a = Math.PI; barb.active = false; barb.state = 'gone'; barb.x = -100; barb.y = -100;
    cat.active = !!(m.diff && { easy: false, normal: false, hard: true }[m.diff]);
    setState('play');
    $('screenTitle').classList.add('hidden');
    $('screenEnd').classList.add('hidden');
    $('screenLobby').classList.add('hidden');
    $('screenPause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('mpBoard').classList.remove('hidden');
    this.myInp = { ax: 0, ay: 0, p: 0, b: 0 };
    if (this.inTimer) clearInterval(this.inTimer);
    this.inTimer = setInterval(() => this.sendInput(), 66);
    sndBark();
    toast(this.TT().start, 'gold');
    state.cam.x = player.x; state.cam.y = player.y;
    state.time = 0;
    (window as unknown as { __mpActive?: boolean }).__mpActive = true;
  },
  sendInput(): void {
    if (!this.inGame) return;
    this.wsSend({ t: 'i', ax: this.myInp.ax, ay: this.myInp.ay, p: this.myInp.p, b: this.myInp.b });
    this.myInp.b = 0;
  },

  onSnap(m: SnapMsg): void {
    if (!this.inGame) return;
    if (m.ev) {
      for (const e of m.ev) {
        if ((e as unknown[])[0] === 'st') this.claim((e as number[])[1], (e as number[])[2], (e as number[])[3], (e as number[])[4]);
        else if ((e as unknown[])[0] === 'er') this.erase((e as number[])[1], (e as number[])[2], (e as number[])[3]);
        else if ((e as unknown[])[0] === 'fx') this.onFx((e as unknown[]) as unknown[]);
      }
      m.ev = undefined;
    }
    this.snapS = m;
    state.timeLeft = m.tm as number;
    if (m.pts) state.pts = m.pts[this.seat] || 0;
    this.myPct = (m.pct as number[])[this.seat] || 0;
    (window as unknown as { __mpMyPct?: number }).__mpMyPct = this.myPct;
    if (m.sp && m.sp.length === mapGeom.spots.length) {
      for (let i = 0; i < mapGeom.spots.length; i++) {
        const sp = m.sp[i];
        mapGeom.spots[i].owner = sp[0];
        mapGeom.spots[i].p1 = sp[1][this.seat] || 0;
        let mx = 0; for (let j = 0; j < 3; j++) if (j !== this.seat) mx = Math.max(mx, sp[1][j] || 0);
        mapGeom.spots[i].p2 = mx;
      }
    }
    const bonesArr = getBones();
    for (let i = 0; i < bonesArr.length; i++) bonesArr[i].on = !!(m.bo && m.bo.includes(i));
  },

  onFx(f: unknown[]): void {
    const k = f[0] as string;
    if (k === 'st') { this.claim(f[1] as number, f[2] as number, f[3] as number, f[4] as number); }
    else if (k === 'er') { this.erase(f[1] as number, f[2] as number, f[3] as number); }
    else if (k === 'bark') {
      rings.push({ x: f[1] as number, y: f[2] as number, r: 16, life: .6 }); rings.push({ x: f[1] as number, y: f[2] as number, r: 2, life: .7 });
      sndBark(); if (f[4] === this.seat) vib(15, 'light');
    }
    else if (k === 'bone') { sndCoin(); floater(f[1] as number, (f[2] as number) - 18, '+25', '#8A5E0E'); if (f[3] === this.seat) { vib(20, 'light'); dust(f[1] as number, f[2] as number, 3, 30); } }
    else if (k === 'water') { sndDrink(); if (f[3] === this.seat) toastOnce('water', 4, mpT('water'), 'gold'); }
    else if (k === 'spot') {
      sndJingle();
      const who = f[3] === this.seat ? this.TT().you : (((this.players as (MPPlayer | null)[]).find(p => p && p.seat === f[3]) || { name: '' }).name);
      toast(mpTF('spot', who), 'gold');
      if (f[3] === this.seat) vib([30, 60, 30], 'rigid');
    }
    else if (k === 'yelp') { sndYelp(); }
    else if (k === 'meow') { sndMeow(); }
    else if (k === 'pts') { floater(f[2] as number, f[3] as number, String(f[4]), '#B37A16'); }
    else if (k === 'chase') { toastOnce('mpchase', 3, mpT('chase'), 'gold'); }
    else if (k === 'barbin') { sndRoar(); state.shake = Math.max(state.shake, 8); toast(mpT('barbIn'), 'red'); }
    else if (k === 'scat') {
      const seat = f[1] as number, bx = f[2] as number, by = f[3] as number;
      sndFight(); state.shake = Math.max(state.shake, 10);
      const nm = seat === this.seat ? this.TT().you : ((((this.players as (MPPlayer | null)[]).find(p => p && p.seat === seat)) || {}).name || '?');
      toast(mpTF('scat', nm), 'red');
      const vic = seat === this.seat ? player : ((this.remotes.find(r => r.seat === seat) || {}).dog);
      if (vic) {
        const mx2 = (vic.x + bx) / 2, my2 = (vic.y + by) / 2;
        this.brawlFx = { x: mx2, y: my2, t: .8, fxT: 0 };
        for (let i = 0; i < 10; i++) parts.push({ x: mx2 + rnd(-14, 14), y: my2 + rnd(-14, 14), vx: rnd(-90, 90), vy: rnd(-90, 90), life: .5, ml: .5, r: rnd(2, 4), col: '#F2C94C', type: 'star' });
        dust(mx2, my2, 8, 70);
        if (seat === this.seat) { player.inBrawl = true; barb.inBrawl = true; }
      }
      if (seat === this.seat) { this.stunT = .8; vib([60, 40, 60], 'rigid'); }
    }
    else if (k === 'barkbig') { toast(mpT('barkBig'), 'gold'); sndYelp(); }
    else if (k === 'barksmall') { toast(mpT('barkSmall'), 'red'); sndRoar(); }
    else if (k === 'left') {
      const s = (((this.players as (MPPlayer | null)[]).find(p => p && p.seat === f[1]) || { name: '?' }).name);
      this.remotes = this.remotes.filter(r => r.seat !== f[1]);
      toast(this.TT().left(s as string), 'slate');
    }
  },

  update(dt: number): void {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 26 * dt);
    const m = this.snapS;
    const { key, input, joy } = (window as unknown as { key: Record<string, boolean>, input: { space: boolean; btn: boolean; bark: boolean }, joy: { on: boolean; vx: number; vy: number } });
    let ax = ((key.ArrowRight || key.KeyD) ? 1 : 0) - ((key.ArrowLeft || key.KeyA) ? 1 : 0);
    let ay = ((key.ArrowDown || key.KeyS) ? 1 : 0) - ((key.ArrowUp || key.KeyW) ? 1 : 0);
    if (joy.on) { ax = joy.vx; ay = joy.vy; }
    const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    this.myInp.ax = ax; this.myInp.ay = ay;
    this.myInp.p = (input.space || input.btn) ? 1 : 0;
    if (input.bark) { input.bark = false; this.myInp.b = 1; if (player.barkCd <= 0 && this.stunT <= 0) player.barkCd = 5; }
    if (this.stunT > 0) this.stunT -= dt;
    if (this.brawlFx) {
      const bf = this.brawlFx;
      bf.t -= dt; bf.fxT -= dt;
      if (bf.fxT <= 0) { bf.fxT = .12; dust(bf.x, bf.y, 2, 60); }
      if (bf.t <= 0) {
        dust(bf.x, bf.y, 8, 70);
        this.brawlFx = null; player.inBrawl = false; barb.inBrawl = false;
      }
    }
    if (!this.inGame) { // после финала — только частицы
      updateParts(dt);
      for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].life -= dt * .9; if (floaters[i].life <= 0) floaters.splice(i, 1); }
      return;
    }
    // мой пёс: локальное предсказание
    const B = SK().base as Record<string, number>;
    player.barkCd = Math.max(0, player.barkCd - dt);
    let pax = ax, pay = ay;
    if (this.stunT > 0) { pax = 0; pay = 0; }
    const cap = (player.peeing ? 78 : 205) * B.spd, k = 1 - Math.exp(-9 * dt);
    player.vx += (pax * cap - player.vx) * k; player.vy += (pay * cap - player.vy) * k;
    player.x += player.vx * dt; player.y += player.vy * dt;
    const { collide } = (window as unknown as { collide: (e: { x: number; y: number }, r: number) => void });
    collide(player, 13 * player.sc);
    const sp = Math.hypot(player.vx, player.vy);
    player.moving = sp > 20;
    if (sp > 25) player.a = lerpAng(player.a, Math.atan2(player.vy, player.vx), Math.min(1, 11 * dt));
    player.phase += sp * dt * .075;
    player.stationary = sp < 22 ? player.stationary + dt : 0;
    if (sp > 150) { player.dustT -= dt; if (player.dustT <= 0) { player.dustT = .09; dust(player.x - Math.cos(player.a) * 12, player.y - Math.sin(player.a) * 12, 1, 20); } }
    // сверка с сервером
    if (m && m.s && m.s[this.seat]) {
      const s0 = m.s[this.seat];
      const dx = s0[0] - player.x, dy = s0[1] - player.y, dd = Math.hypot(dx, dy);
      if (dd > (this.stunT > 0 ? 24 : 70)) { player.x = s0[0]; player.y = s0[1]; }
      else { player.x += dx * Math.min(1, dt * 4); player.y += dy * Math.min(1, dt * 4); }
      player.peeing = !!s0[4]; player.bladder = s0[5];
      if (s0[6] > player.barkCd) player.barkCd = s0[6];
    }
    // чужие псы
    if (m && m.s) {
      this.remotes = this.remotes.filter(r => {
        const s = m.s?.[r.seat];
        if (!s) { r.missT = (r.missT || 0) + 1; return r.missT <= 40; }
        r.missT = 0; return true;
      });
      for (const r of this.remotes) {
        const s = m.s[r.seat]; if (!s) continue;
        const d = r.dog;
        d.x += (s[0] - d.x) * Math.min(1, dt * 14); d.y += (s[1] - d.y) * Math.min(1, dt * 14);
        d.a = lerpAng(d.a, s[2], Math.min(1, dt * 12));
        d.moving = !!s[3]; d.peeing = !!s[4]; d.phase = s[8] || 0;
      }
    }
    // NPC
    if (m) {
      if (m.r) { const t = this.npcT.r || (this.npcT.r = { x: 0, y: 0, a: 0, st: '', mv: false, ph: 0 }); t.x = m.r[0]; t.y = m.r[1]; t.a = m.r[2]; t.st = String(m.r[3]); t.mv = !!m.r[4]; t.ph = m.r[5]; }
      if (m.b) { const t = this.npcT.b || (this.npcT.b = { x: 0, y: 0, a: 0, st: '', mv: false, ph: 0 }); t.x = m.b[0]; t.y = m.b[1]; t.a = m.b[2]; t.st = String(m.b[3]); t.mv = !!m.b[4]; t.ph = m.b[5]; }
      else { barb.active = false; barb.state = 'gone'; }
      if (m.c) { const t = this.npcT.c || (this.npcT.c = { x: 0, y: 0, a: 0, st: '', mv: false, ph: 0 }); t.x = m.c[0]; t.y = m.c[1]; t.a = m.c[2]; t.st = String(m.c[3]); t.mv = !!m.c[4]; t.ph = m.c[5]; }
    }
    const sm = (o: DogState, t: { x: number; y: number; a: number; ph: number } | null): void => {
      if (!t) return; const f = Math.min(1, dt * 12);
      o.x += (t.x - o.x) * f; o.y += (t.y - o.y) * f; o.a = lerpAng(o.a, t.a, f); o.phase = t.ph;
    };
    sm(rival, this.npcT.r); rival.moving = this.npcT.r ? this.npcT.r.mv : rival.moving;
    if (this.npcT.b) { barb.active = true; barb.state = this.npcT.b.st === 'gone' ? 'gone' : (this.npcT.b.st as BarbStateStr); if (barb.state !== 'gone') { sm(barb, this.npcT.b); barb.moving = this.npcT.b.mv; } }
    if (this.npcT.c) { cat.active = true; cat.state = this.npcT.c.st as CatStateStr; sm(cat, this.npcT.c); cat.moving = this.npcT.c.mv; }
    // камера
    const tx = clamp(player.x + Math.cos(player.a) * 36, state.vw / 2, W - state.vw / 2);
    const ty = clamp(player.y + Math.sin(player.a) * 36, state.vh / 2, H - state.vh / 2);
    state.cam.x += (tx - state.cam.x) * Math.min(1, dt * 4.5);
    state.cam.y += (ty - state.cam.y) * Math.min(1, dt * 4.5);
    if (state.vw >= W) state.cam.x = W / 2; if (state.vh >= H) state.cam.y = H / 2;
    // частицы/поплавки
    updateParts(dt);
    for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].life -= dt * .9; if (floaters[i].life <= 0) floaters.splice(i, 1); }
    for (const s of mapGeom.spots) s.pulse = Math.max(0, s.pulse - dt * 1.5);
    // табло
    this.boardT += dt;
    if (this.boardT > .5) { this.boardT = 0; this.renderBoard(m); }
  },
  renderBoard(m: SnapMsg | null): void {
    if (!m) return;
    const el = $('mpBoard');
    const rows = [0, 1, 2].map(i => {
      const p = (this.players as (MPPlayer | null)[]).find(x => x && x.seat === i); if (!p) return null;
      return { seat: i, name: p.name, pct: (m.pct as number[])[i] || 0, pts: ((m.pts && m.pts[i]) || 0) };
    }).filter(Boolean) as { seat: number; name: string; pct: number; pts: number }[];
    rows.sort((a, b) => b.pct - a.pct);
    el.innerHTML = rows.map((r, i) =>
      '<div class="mpSeat' + (r.seat === this.seat ? ' me' : '') + (i === 0 ? ' lead' : '') + '">' +
      '<span class="dot" style="background:' + (SEATPAL[r.seat + 1] || '#EFC94C') + '"></span>' +
      esc(r.name) + '<b>' + r.pct.toFixed(1) + '%</b></div>').join('');
  },
  minimap(mm: CanvasRenderingContext2D): void {
    for (const r of this.remotes) {
      mm.fillStyle = SEATPAL[r.seat + 1] || '#EFC94C';
      mm.strokeStyle = '#2E2A26'; mm.lineWidth = 1.2;
      mm.beginPath(); mm.arc(r.dog.x / W * 156, r.dog.y / H * 104, 3, 0, TAU); mm.fill(); mm.stroke();
    }
  },
  renderDogs(ctx: CanvasRenderingContext2D): void {
    for (const r of this.remotes) {
      drawDog(ctx, r.dog, SKINS[r.skin]);
      drawLabel(ctx, r.dog, r.name, SEATPAL[r.seat + 1] || '#EFC94C');
    }
  },

  onEnd(m: SnapMsg): void {
    if (!this.inGame) return;
    this.inGame = false; this.mpEnd = true; this.active = true;
    this.brawlFx = null; player.inBrawl = false; barb.inBrawl = false;
    if (this.inTimer) { clearInterval(this.inTimer); this.inTimer = null; }
    setState('end'); stopPeeSnd(); sndEnd();
    vib([40, 60, 40, 60, 150], 'rigid');
    const T = this.TT();
    const standings = m.standings as { seat: number; name: string; pct: number; pts: number }[];
    const my = standings.findIndex(s => s.seat === this.seat);
    const place = my + 1;
    ($('rankTitle') as HTMLElement).textContent = place === 1 ? T.t1 : T.place(place);
    ($('rankSub') as HTMLElement).textContent = place === 1 ? T.t2 : '';
    ($('endTag') as HTMLElement).textContent = T.mpT + ' · ' + (LN().maps && LN().maps[this.map] || this.map) + ' · ' + this.code;
    $('recLine').classList.toggle('on', place === 1);
    if (place === 1) ($('recLine') as HTMLElement).textContent = '★ ' + T.t1;
    const rows = standings.map((s, i) => [
      (i + 1) + '. ' + esc(s.name) + (s.seat === this.seat ? ' (' + T.you + ')' : ''),
      s.pct.toFixed(1) + '% · ' + Math.round(s.pts)] as [string, string]);
    ($('statsBox') as HTMLElement).innerHTML = rows.map(([k, v], i) =>
      '<div class="row' + (i === 0 ? ' total' : '') + '"><span style="color:' + (SEATPAL[standings[i].seat + 1] || '#EFC94C') + '">' + k + '</span><b>' + v + '</b></div>').join('');
    this.lastStandings = standings;
    $('screenEnd').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('mpBoard').classList.add('hidden');
    (window as unknown as { __mpActive?: boolean }).__mpActive = false;
  },
  toastDisc(): void {
    this.inGame = false; this.active = false;
    if (this.inTimer) { clearInterval(this.inTimer); this.inTimer = null; }
    stopPeeSnd();
    toast(this.TT().disc, 'red');
    this.leave(true);
  },
  share(): void {
    const T = this.TT();
    const link = 'https://t.me/glavny_pes_bot/app?startapp=' + this.code;
    const txt = T.inv(this.code, link);
    if (navigator.share) { navigator.share({ text: txt }).catch(() => { /* noop */ }); return; }
    try { navigator.clipboard.writeText(txt).then(() => toast(T.copied, 'gold'), () => this.fallbackCopy(txt)); }
    catch (e) { this.fallbackCopy(txt); }
  },
  fallbackCopy(txt: string): void {
    const ta = document.createElement('textarea'); ta.value = txt;
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(this.TT().copied, 'gold'); } catch (e) { /* noop */ }
    ta.remove();
  },
  leave(toTitle: boolean): void {
    this.inGame = false; this.active = false; this.mpEnd = false;
    this.brawlFx = null; player.inBrawl = false;
    if (this.inTimer) { clearInterval(this.inTimer); this.inTimer = null; }
    if (this.ws) { try { this.ws.close() } catch (e) { /* noop */ } this.ws = null; }
    $('mpBoard').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('screenEnd').classList.add('hidden');
    $('screenLobby').classList.add('hidden');
    this.closeLobby(toTitle);
    setState('attract');
    (window as unknown as { __mp_resetWorldFull?: () => void }).__mp_resetWorldFull?.();
    this.ws = null; this.seat = -1;
    (window as unknown as { __mpActive?: boolean }).__mpActive = false;
    (window as unknown as { __mpMyPct?: number }).__mpMyPct = undefined;
  },

  init(): void {
    $('btnFriends').addEventListener('click', () => this.openLobby());
    $('btnRoomCreate').addEventListener('click', () => { initAudio(); this.create(); });
    $('btnRoomJoin').addEventListener('click', () => { initAudio(); this.join(($('codeInput') as HTMLInputElement).value); });
    ($('codeInput') as HTMLInputElement).addEventListener('keydown', e => {
      if (e.key === 'Enter') { this.join(($('codeInput') as HTMLInputElement).value); e.preventDefault(); e.stopPropagation(); }
    });
    $('btnLobbyStart').addEventListener('click', () => this.startMatch());
    $('btnLobbyShare').addEventListener('click', () => this.share());
    $('btnLobbyLeave').addEventListener('click', () => { if (this.ws) { try { this.ws.close() } catch (e) { /* noop */ } } this.leave(true); });
    ($('btnLobbyStart') as HTMLElement).style.display = 'none';
    document.querySelectorAll('.lobMapBtn').forEach(b => b.addEventListener('click', () => {
      this.map = (b as HTMLElement).dataset.m as string; this.sendLobbySet(); this.renderLobby();
    }));
    document.querySelectorAll('.lobDiffBtn').forEach(b => b.addEventListener('click', () => {
      this.diff = (b as HTMLElement).dataset.d as string; this.sendLobbySet(); this.renderLobby();
    }));
    $('btnAgain').addEventListener('click', () => { if (MP.mpEnd) MP.restart(); });
    $('btnMenuEnd').addEventListener('click', () => { if (MP.active) MP.leave(true); });
    $('btnMenuPause').addEventListener('click', () => { if (MP.active) MP.leave(true); });
    // автоподключение по ссылке-приглашению
    let code: string | null = null;
    try { if (TMA && TMA.initDataUnsafe && TMA.initDataUnsafe.start_param) code = TMA.initDataUnsafe.start_param } catch (e) { /* noop */ }
    if (!code) { const q = new URLSearchParams(location.search).get('room'); if (q) code = q; }
    if (code && /^[A-Z0-9]{4}$/i.test(code)) {
      this.openLobby();
      setTimeout(() => MP.join(code as string), 400);
    }
    // хуки для game.ts (MP-режим без циклического импорта)
    (window as unknown as { __mpActive?: boolean }).__mpActive = false;
    (window as unknown as { __mpUpdate: (dt: number) => void }).__mpUpdate = (dt: number) => this.update(dt);
    (window as unknown as { __mpRenderDogs: (ctx: CanvasRenderingContext2D) => void }).__mpRenderDogs = (c: CanvasRenderingContext2D) => this.renderDogs(c);
    (window as unknown as { __mpMinimap: (mm: CanvasRenderingContext2D) => void }).__mpMinimap = (mmc: CanvasRenderingContext2D) => this.minimap(mmc);
    (window as unknown as { __mp_resetWorldFull: () => void }).__mp_resetWorldFull = () => {
      import('./game').then(g => { g.resetWorld(); });
      import('./world').then(w => { w.bakeMap(); w.bakeTop(); });
    };
    (window as unknown as { __mp_resetWorld: () => void }).__mp_resetWorld = () => {
      const w = (window as unknown as { __gp_resetWorld?: () => void }).__gp_resetWorld;
      w?.();
    };
    (window as unknown as { __mp_setMapKey: (k: string) => void }).__mp_setMapKey = (k: string) => { import('./state').then(s => s.setMapKey(k)); };
    (window as unknown as { __mp_setDiffKey: (k: string) => void }).__mp_setDiffKey = (k: string) => { import('./state').then(s => s.setDiffKey(k)); };
  },
};
type BarbStateStr = 'gone' | 'patrol' | 'chase' | 'mark' | 'flee';
type CatStateStr = 'walk' | 'scratch' | 'flee';

export function initMP(): void {
  MP.init();
  (window as unknown as { __mpReady?: boolean }).__mpReady = true;
  (window as Window & { __MP?: unknown }).__MP = MP;
}
initMP();
