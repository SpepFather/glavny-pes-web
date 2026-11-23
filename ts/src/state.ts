// Глобальное состояние игры + сохранения — перенос 1:1 (save v4, топ-ключи localStorage)
import { L10N, type LangKey } from './i18n';
import { DIFFS, SKINS, MAPS } from './config';
export { SKINS };
import type { PlayerState, RivalState, CatState, BarbState, Spot, Bone, Bowl, Pigeon, Drop, Part, Floater, Ring, Cloud } from './types';

export type GameState = 'attract' | 'play' | 'pause' | 'end';
export type QualityMode = 'low' | 'high';

export interface Save { v?: number; name?: string; skin?: number; diff?: string; map?: string; muted?: boolean; vol?: number; mvol?: number; vib?: boolean; q?: string; lang?: string; tut?: number }

let save: Save = {};
try { save = JSON.parse(localStorage.getItem('topdog-save') || '{}') } catch (e) { save = {} }
export const OLD_SAVE = save.v === 3 || save.v === 4;
export const SAVE = save;

export const qSetting: string = (['auto', 'high', 'low'].indexOf(save.q ?? '') >= 0) ? save.q as string : 'auto';

export let lang: LangKey = (save.lang && L10N[save.lang as LangKey]) ? save.lang as LangKey
  : (() => {
    const n = (navigator.language || 'ru').toLowerCase();
    return n.startsWith('ru') ? 'ru' : n.startsWith('zh') ? 'zh' : n.startsWith('es') ? 'es' : 'en';
  })();
export function setLang(l: LangKey): void { lang = l }
export const LN = () => L10N[lang];

export let diffKey: string = DIFFS[save.diff ?? ''] ? save.diff as string : 'normal';
export function setDiffKey(k: string): void { diffKey = k }
export const D = () => DIFFS[diffKey];

export let skinIdx: number = (OLD_SAVE && Number.isInteger(save.skin) && (save.skin as number) >= 0 && (save.skin as number) < SKINS.length) ? save.skin as number : 0;
export function setSkinIdx(i: number): void { skinIdx = i }
export const SK = (): typeof SKINS[0] => SKINS[skinIdx];

export let mapKey: string = (OLD_SAVE && MAPS.some(m => m.id === (save.map ?? ''))) ? save.map as string : 'yards';
export function setMapKey(k: string): void { mapKey = k }
export const MAP = () => MAPS.find(m => m.id === mapKey) as NonNullable<ReturnType<typeof MAPS.find>>;

// ---------- кличка игрока ----------
let playerName = (save.name || '').trim().slice(0, 12) || L10N[lang].defName;
export function playerNameStr(): string { return playerName }
export function updatePlayerName(n: string): void { playerName = n }

// ---------- состояние партии ----------
export const state = {
  mode: 'attract' as GameState,
  time: 0, pts: 0, dispPts: 0, timeLeft: 90, warned10: false, shake: 0, hintHidden: false,
  showEndT: null as ReturnType<typeof setTimeout> | null,
  barbWarnT: null as ReturnType<typeof setTimeout> | null,
  hintT: null as ReturnType<typeof setTimeout> | null,
  stats: { chased: 0, pigeons: 0, pee: 0, allSpots: false, catChased: 0, brawls: 0, brawlsWon: 0, spots: 0 },
  cam: { x: 1680 / 2, y: 1120 / 2 },
  vw: innerWidth, vh: innerHeight, dpr: 1,
  lastShare: '',
  qMode: (qSetting === 'low' ? 'low' : 'high') as QualityMode,
  muted: !!save.muted,
};
export function setState(m: GameState): void { state.mode = m }

export const player: PlayerState = {
  x: 150, y: 562, vx: 0, vy: 0, a: 0, phase: 0, id: 0, sc: 1, peeing: false, bladder: 70, stationary: 0,
  peeTick: 0, stampT: 0, dustT: 0, excited: false, moving: false, aiT: 0, aiPee: 0, tx: 150, ty: 562,
  inBrawl: false, barkCd: 0, brawl: null,
};
export const BARK_CD = 5;
export const rival: RivalState = {
  x: 1520, y: 940, vx: 0, vy: 0, a: Math.PI, phase: 0, id: 1, sc: 1, peeing: false, moving: false, excited: false,
  state: 'walk', tx: 900, ty: 300, t: 0, fleeCd: 0, markTick: 0, stampT: 0, stuck: 0, inBrawl: false, brawl: null,
};
export const cat: CatState = {
  x: 830, y: 120, tx: 830, ty: 120, vx: 0, vy: 0, a: 0, phase: 0, id: 7, sc: 1, state: 'walk', t: 0, fleeCd: 0,
  erT: 0, stuck: 0, active: false, moving: false, excited: false, peeing: false,
};
export const barb: BarbState = {
  x: -60, y: 560, vx: 0, vy: 0, a: 0, phase: 0, id: 3, sc: 1.5, peeing: false, moving: false, excited: false,
  state: 'gone', tx: 840, ty: 560, t: 0, spawnT: 0, everSpawned: false, attackCd: 0, markTick: 0, stampT: 0, stuck: 0,
  goneT: 0, brawl: null, active: false, inBrawl: false,
};

export const drops: Drop[] = [], parts: Part[] = [], floaters: Floater[] = [], clouds: Cloud[] = [], rings: Ring[] = [];
export let bones: Bone[] = [];
export let pigeons: Pigeon[] = [];
export function setBones(b: Bone[]): void { bones = b }
export function setPigeons(p: Pigeon[]): void { pigeons = p }
export const getBones = () => bones, getPigeons = () => pigeons;

// ---------- геометрия карты ----------
import type { House, Tent, Car } from './config';
export const mapGeom = {
  houses: [] as House[],
  rectColl: [] as (import('./types').Rect)[],
  circColl: [] as (import('./types').Circ)[],
  trees: [] as [number, number, number][],
  bushes: [] as [number, number][],
  lamps: [] as [number, number][],
  hydrants: [] as [number, number][],
  cans: [] as [number, number][],
  benches: [] as [number, number][],
  bowls: [] as Bowl[],
  boneSpawns: [] as [number, number][],
  pigeonSpawns: [] as [number, number][],
  spots: [] as Spot[],
};

// ---------- глобальная статистика и достижения ----------
export interface StatsG { runs?: number; rex?: number; cat?: number; pigeons?: number; brawlsWon?: number; spotsAll?: number; bestPct?: number; bestSpots?: number; bestTotal?: number; hardBest?: number }
let statsG: StatsG = (() => { try { return JSON.parse(localStorage.getItem('topdog-stats') || '{}') } catch (e) { return {} } })();
statsG.runs = statsG.runs || 0; statsG.rex = statsG.rex || 0; statsG.cat = statsG.cat || 0;
statsG.pigeons = statsG.pigeons || 0; statsG.brawlsWon = statsG.brawlsWon || 0; statsG.spotsAll = statsG.spotsAll || 0;
statsG.bestPct = statsG.bestPct || 0; statsG.bestSpots = statsG.bestSpots || 0; statsG.bestTotal = statsG.bestTotal || 0; statsG.hardBest = statsG.hardBest || 0;
export const STATSG = statsG;
export function saveStatsG(): void { try { localStorage.setItem('topdog-stats', JSON.stringify(statsG)) } catch (e) { /* noop */ } }

let ach: Record<string, number> = (() => { try { return JSON.parse(localStorage.getItem('topdog-ach') || '{}') } catch (e) { return {} } })();
export const ACH_STATE = ach;
export function saveAch(): void { try { localStorage.setItem('topdog-ach', JSON.stringify(ach)) } catch (e) { /* noop */ } }

export const ACH: { id: string; ic: string }[] = [
  { id: 'walk1', ic: '🐾' }, { id: 'yard', ic: '🏡' }, { id: 'spots5', ic: '🚩' }, { id: 'all12', ic: '🌟' },
  { id: 'rex15', ic: '🐕' }, { id: 'barb', ic: '💪' }, { id: 'cat', ic: '🐈' }, { id: 'dove10', ic: '🕊️' },
  { id: 'rich', ic: '💰' }, { id: 'boss', ic: '👑' }, { id: 'runs10', ic: '🔁' }, { id: 'hard', ic: '⭐' },
];
export function achCond(id: string): boolean {
  const g = statsG;
  switch (id) {
    case 'walk1': return (g.runs || 0) >= 1;
    case 'yard': return (g.bestPct || 0) >= 7.5;
    case 'spots5': return (g.bestSpots || 0) >= 5;
    case 'all12': return (g.spotsAll || 0) >= 1;
    case 'rex15': return (g.rex || 0) >= 15;
    case 'barb': return (g.brawlsWon || 0) >= 1;
    case 'cat': return (g.cat || 0) >= 1;
    case 'dove10': return (g.pigeons || 0) >= 10;
    case 'rich': return (g.bestTotal || 0) >= 1000;
    case 'boss': return (g.bestPct || 0) >= 18;
    case 'runs10': return (g.runs || 0) >= 10;
    case 'hard': return (g.hardBest || 0) >= 10;
  }
  return false;
}
export function bumpRun(run: { pct: number; spots: number; total: number; diff: string; rex: number; cat: number; pigeons: number; brawlsWon: number }): void {
  statsG.runs = (statsG.runs || 0) + 1;
  statsG.rex = (statsG.rex || 0) + run.rex; statsG.cat = (statsG.cat || 0) + run.cat; statsG.pigeons = (statsG.pigeons || 0) + run.pigeons;
  statsG.brawlsWon = (statsG.brawlsWon || 0) + run.brawlsWon;
  if (run.spots >= 12) statsG.spotsAll = (statsG.spotsAll || 0) + 1;
  statsG.bestPct = Math.max(statsG.bestPct || 0, run.pct);
  statsG.bestSpots = Math.max(statsG.bestSpots || 0, run.spots);
  statsG.bestTotal = Math.max(statsG.bestTotal || 0, run.total);
  if (run.diff === 'hard') statsG.hardBest = Math.max(statsG.hardBest || 0, run.pct);
  saveStatsG();
  const fresh: typeof ACH = [];
  for (const a of ACH) if (!ach[a.id] && achCond(a.id)) { ach[a.id] = 1; fresh.push(a); }
  if (fresh.length) {
    saveAch();
    fresh.forEach((a, i) => setTimeout(() => {
      import('./fx').then(({ toast }) => {
        toast(L10N[lang].a_new(L10N[lang].ach[a.id][0]), 'gold');
        import('./audio').then(a => a.vib([30, 60, 30], 'rigid'));
      });
    }, 600 + i * 1400));
  }
}
export function loadBests(): Record<string, number> { try { return JSON.parse(localStorage.getItem('topdog-best') || '{}') } catch (e) { return {} } }
