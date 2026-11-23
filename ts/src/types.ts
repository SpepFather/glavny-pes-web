// Общие типы и константы мира (перенос 1:1 из game-core.js)
export const TAU = Math.PI * 2;

export type Canvas = { getContext: never } | HTMLCanvasElement | OffscreenCanvas; // alias-заглушка не нужна — используем HTMLCanvasElement напрямую ниже

export const W = 1680, H = 1120, CELL = 14, GW = (W / CELL) | 0, GH = (H / CELL) | 0;
export const EMPTY = 0, OWN = 1, REX = 2, BARB = 3, BLOCKED = 4;

export const IS_ANDROID = /Android/i.test(navigator.userAgent);
export const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || IS_ANDROID;
export const LOW_END = IS_TOUCH && (navigator.hardwareConcurrency || 8) <= 4;
export const LOWFI = IS_TOUCH;
export const DROP_CAP = LOWFI ? 180 : 260;

// ---------- математика ----------
export const rnd = (a = 1, b?: number): number => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number): number => v < a ? a : v > b ? b : v;
export const dist = (x1: number, y1: number, x2: number, y2: number): number => Math.hypot(x2 - x1, y2 - y1);
export function lerpAng(a: number, b: number, t: number): number {
  let d = (b - a + Math.PI) % TAU; if (d < 0) d += TAU; d -= Math.PI; return a + d * t;
}
export function circ(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
export function ell(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
}
export const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

// ---------- сущности ----------
export interface DogState {
  x: number; y: number; vx: number; vy: number; a: number; phase: number; id: number;
  sc: number; peeing: boolean; moving: boolean; excited: boolean;
}
export interface PlayerState extends DogState {
  bladder: number; stationary: number; peeTick: number; stampT: number; dustT: number;
  aiT: number; aiPee: number; tx: number; ty: number; inBrawl: boolean; barkCd: number; brawl: Brawl | null;
}
export interface RivalState extends DogState {
  state: 'walk' | 'mark' | 'flee'; tx: number; ty: number; t: number; fleeCd: number;
  markTick: number; stampT: number; stuck: number; inBrawl: boolean; brawl: Brawl | null;
}
export interface CatState extends DogState {
  tx: number; ty: number; state: 'walk' | 'scratch' | 'flee'; t: number; fleeCd: number;
  erT: number; stuck: number; active: boolean;
}
export interface BarbState extends DogState {
  state: 'gone' | 'patrol' | 'chase' | 'mark' | 'flee'; tx: number; ty: number; t: number;
  spawnT: number; everSpawned: boolean; attackCd: number; markTick: number; stampT: number;
  stuck: number; goneT: number; brawl: Brawl | null; active: boolean; inBrawl: boolean;
}
export interface Brawl { other: DogState & { inBrawl?: boolean }; x: number; y: number; t: number; fxT: number }
export interface Spot { x: number; y: number; kind: 'hydrant' | 'lamp' | 'can'; owner: number; p1: number; p2: number; pulse: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Circ { x: number; y: number; r: number }
export interface Bone { x: number; y: number; rot: number; on: boolean; rt: number }
export interface Bowl { x: number; y: number; cd: number }
export interface Pigeon { x: number; y: number; a: number; state: 'idle' | 'fly' | 'gone'; t: number; fly: number; fvx: number; fvy: number; id: number }
export interface Floater { x: number; y: number; text: string; col: string; life: number }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; ml: number; r: number; col: string; type: 'dust' | 'bub' | 'star' }
export interface Ring { x: number; y: number; r: number; life: number }
export interface Drop { x: number; y: number; vx: number; vy: number; life: number; ml: number; r: number; col: string; owner: number }
export interface Cloud { x: number; y: number; vx: number; blobs: { dx: number; dy: number; r: number }[] }
