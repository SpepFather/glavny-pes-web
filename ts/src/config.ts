// Конфигурация игры: сложности, размеры, породы, карты — перенос 1:1
import type { Rect } from './types';

export interface DiffCfg {
  time: number; rSpeed: number; rFlee: number; rFleeT: number; rMarkTick: number;
  rClaimR: number; rHunt: number; rSpotT: number; spotT: number; drain: number;
  regen: number; cat: boolean; barbAt: number | null; mult: number;
}
export const DIFFS: Record<string, DiffCfg> = {
  easy: { time: 120, rSpeed: 68, rFlee: 170, rFleeT: 2.0, rMarkTick: .07, rClaimR: 28, rHunt: .3, rSpotT: 1.15, spotT: .7, drain: 10, regen: 11, cat: false, barbAt: null, mult: 1 },
  normal: { time: 90, rSpeed: 100, rFlee: 215, rFleeT: 1.7, rMarkTick: .05, rClaimR: 36, rHunt: .45, rSpotT: .9, spotT: .6, drain: 13, regen: 8.5, cat: false, barbAt: 22, mult: 1.25 },
  hard: { time: 75, rSpeed: 132, rFlee: 255, rFleeT: 1.25, rMarkTick: .032, rClaimR: 44, rHunt: .7, rSpotT: .55, spotT: .5, drain: 16.5, regen: 6.5, cat: true, barbAt: 14, mult: 1.6 },
};

export interface SizeCfg { sc: number; markR: number; spd: number; drainM: number }
export const SIZE: Record<string, SizeCfg> = {
  big: { sc: 1.22, markR: 1.28, spd: .92, drainM: .85 },
  med: { sc: 1, markR: 1, spd: 1, drainM: 1 },
  small: { sc: .84, markR: .8, spd: 1.12, drainM: 1.15 },
};

export interface Skin {
  key: string; size: string;
  ov: Record<string, number | boolean>;
  body: string; paw: string; tailTip: string; muzzle: string; collar: string;
  ears: 'pointy' | 'floppy' | 'mixed'; bigEars?: boolean; tailLess?: boolean;
  chest?: string; mask?: string; topknot?: boolean; fluffy?: boolean;
  patch?: string; eyes?: string; brows?: boolean; earCol?: string;
  saddle?: string; cap?: string; ruff?: string; scar?: boolean; spiked?: boolean;
  angry?: boolean; spots?: { col: string; n: number };
  base: SizeCfg & Record<string, number | boolean>;
}
export const SKINS: Skin[] = [
  { key: 'dvorn', size: 'small', ov: { chasePts: 2, chaseFlee: 1.5 }, body: '#B0A189', paw: '#9C8C74', tailTip: '#D8CDB4', muzzle: '#CFC3A8', collar: '#C4453B', ears: 'mixed', patch: '#7A6A52', chest: '#CFC3A8', base: null as never },
  { key: 'corgi', size: 'small', ov: { markR: 1, spd: 1.15 }, body: '#E08A3C', paw: '#C97430', tailTip: '#E08A3C', muzzle: '#F6F1E6', collar: '#C4453B', ears: 'pointy', bigEars: true, tailLess: true, chest: '#F6F1E6', mask: '#F6F1E6', base: null as never },
  { key: 'poodle', size: 'small', ov: { stampM: .6 }, body: '#F4EDDF', paw: '#E6DCC6', tailTip: '#F4EDDF', muzzle: '#EAE0C9', collar: '#8E6FB8', ears: 'floppy', topknot: true, fluffy: true, base: null as never },
  { key: 'husky', size: 'med', ov: { drainM: .7 }, body: '#C2CBD4', paw: '#AEB8C2', tailTip: '#F6F1E6', muzzle: '#F6F1E6', collar: '#2F8F83', ears: 'pointy', mask: '#EEF2F5', eyes: '#3E7CB8', brows: true, base: null as never },
  { key: 'lab', size: 'med', ov: { bowlInstant: true, spd: 1.05 }, body: '#E2B96F', paw: '#D0A75E', tailTip: '#D0A75E', muzzle: '#EFD9A8', collar: '#3E7CB8', ears: 'floppy', base: null as never },
  { key: 'dalm', size: 'med', ov: { spd: 1.2 }, body: '#F6F2E8', paw: '#F6F2E8', tailTip: '#F6F2E8', muzzle: '#F6F2E8', collar: '#D6483F', ears: 'floppy', spots: { col: '#33302B', n: 6 }, base: null as never },
  { key: 'shepherd', size: 'big', ov: { spotM: .62 }, body: '#C08A4E', paw: '#B37F49', tailTip: '#3E362E', muzzle: '#2F2A24', collar: '#3E5F7E', ears: 'pointy', earCol: '#3E362E', saddle: '#4A3F33', cap: '#4A3F33', eyes: '#E8A33D', base: null as never },
  { key: 'caucas', size: 'big', ov: { fearM: 1.6 }, body: '#C9C2B4', paw: '#B7AFA0', tailTip: '#E8E2D5', muzzle: '#DDD6C8', collar: '#5A4632', ears: 'floppy', ruff: '#D8D1C3', fluffy: true, base: null as never },
  { key: 'alabai', size: 'big', ov: { huntM: .5 }, body: '#C9A56A', paw: '#B8925A', tailTip: '#B8925A', muzzle: '#6B5844', collar: '#7E4A28', ears: 'pointy', earCol: '#6B5844', mask: '#6B5844', chest: '#EFE7D2', eyes: '#F2C94C', base: null as never },
];
for (const b of SKINS) b.base = { ...SIZE[b.size], ...(b.ov || {}) } as Skin['base'];

export interface House extends Rect { c: string; r: string; market?: boolean; shed?: boolean }
export interface Tent extends Rect { c: string }
export interface Car extends Rect { c: string }
export interface GameMap {
  id: string; theme: 'grass' | 'asphalt' | 'dirt';
  houses: House[]; cars: Car[]; tents: Tent[];
  hay: [number, number, number][]; tires: [number, number][];
  trees: [number, number, number][]; bushes: [number, number][];
  lamps: [number, number][]; hydrants: [number, number][];
  cans: [number, number][]; benches: [number, number][];
  bowls: { x: number; y: number }[];
}
export const MAPS: GameMap[] = [
  {
    id: 'yards', theme: 'grass',
    houses: [
      { x: 110, y: 100, w: 280, h: 190, c: '#C96F4A', r: '#A85A3C' },
      { x: 470, y: 130, w: 235, h: 150, c: '#B65C3F', r: '#96492F' },
      { x: 130, y: 780, w: 245, h: 175, c: '#A86450', r: '#8A5040' },
      { x: 520, y: 845, w: 215, h: 150, c: '#C96F4A', r: '#A85A3C' },
      { x: 1150, y: 765, w: 270, h: 190, c: '#B65C3F', r: '#96492F' },
    ],
    cars: [], tents: [], hay: [], tires: [],
    trees: [[1055, 165, 46], [1255, 315, 40], [1465, 135, 50], [1595, 340, 36], [995, 365, 34], [335, 330, 42], [85, 205, 34], [330, 1005, 44], [85, 940, 36], [625, 1015, 34], [1060, 725, 40], [1420, 1050, 44], [1620, 750, 36], [600, 415, 30]],
    bushes: [[240, 300], [430, 90], [965, 235], [1530, 428], [235, 725], [690, 770], [975, 790], [1555, 905], [1110, 1050], [60, 690]],
    lamps: [[600, 458], [1240, 458], [200, 662], [1500, 662], [738, 240], [922, 880]],
    hydrants: [[260, 458], [1006, 662], [1544, 458]],
    cans: [[940, 452], [560, 662], [922, 330]],
    benches: [[1180, 410], [1360, 265], [300, 738]],
    bowls: [{ x: 1055, y: 935 }, { x: 640, y: 345 }],
  },
  {
    id: 'lot', theme: 'asphalt',
    houses: [{ x: 150, y: 100, w: 250, h: 160, c: '#8B6F52', r: '#6E5740', market: true }],
    tents: [
      { x: 1180, y: 120, w: 330, h: 170, c: '#C96F4A' },
      { x: 600, y: 120, w: 330, h: 150, c: '#7E9B6E' },
    ],
    cars: [
      { x: 170, y: 250, w: 70, h: 120, c: '#B8443C' },
      { x: 290, y: 250, w: 70, h: 120, c: '#4A7BA6' },
      { x: 410, y: 250, w: 70, h: 120, c: '#D8C14A' },
      { x: 1230, y: 250, w: 70, h: 120, c: '#5E9B6E' },
      { x: 1370, y: 250, w: 70, h: 120, c: '#8A8F96' },
      { x: 170, y: 800, w: 70, h: 120, c: '#6E5A8E' },
      { x: 290, y: 800, w: 70, h: 120, c: '#C98A3C' },
      { x: 410, y: 800, w: 70, h: 120, c: '#7E8CA0' },
      { x: 1250, y: 800, w: 70, h: 120, c: '#B8443C' },
      { x: 1370, y: 800, w: 70, h: 120, c: '#3E7CB8' },
    ],
    hay: [], tires: [[1080, 560], [1140, 600], [1080, 640], [1560, 980]],
    trees: [[80, 560, 38], [1600, 560, 38], [700, 1040, 36], [980, 1040, 36], [80, 80, 30], [1600, 1040, 34]],
    bushes: [[560, 560], [1060, 300], [560, 820], [1060, 900], [820, 190], [820, 980]],
    lamps: [[760, 430], [920, 690], [100, 300], [1580, 300], [100, 900], [1580, 830]],
    hydrants: [[60, 720], [1620, 470], [780, 560]],
    cans: [[980, 430], [700, 690], [1180, 560]],
    benches: [[600, 690], [1080, 400]],
    bowls: [{ x: 880, y: 560 }, { x: 540, y: 980 }],
  },
  {
    id: 'field', theme: 'dirt',
    houses: [
      { x: 150, y: 130, w: 210, h: 150, c: '#A08A6A', r: '#7E6C50', shed: true },
      { x: 1240, y: 150, w: 230, h: 160, c: '#96805E', r: '#756248', shed: true },
      { x: 640, y: 870, w: 190, h: 140, c: '#A08A6A', r: '#7E6C50', shed: true },
      { x: 1180, y: 850, w: 250, h: 170, c: '#8E7A5C', r: '#6E5C44', shed: true },
    ],
    cars: [], tents: [], tires: [[520, 560], [560, 610], [1420, 400], [1470, 450]],
    hay: [[380, 560, 42], [880, 240, 46], [1120, 620, 40]],
    trees: [[90, 380, 36], [160, 980, 40], [1560, 1020, 42], [980, 90, 32], [760, 620, 26], [300, 300, 30], [1340, 620, 34]],
    bushes: [[480, 300], [940, 420], [200, 620], [1100, 300], [640, 300], [1460, 760], [820, 1000], [480, 1020], [100, 760], [1560, 700]],
    lamps: [[620, 452], [1040, 662], [200, 500]],
    hydrants: [[1330, 458], [350, 662]],
    cans: [[920, 330], [700, 900], [1480, 940]],
    benches: [[880, 560]],
    bowls: [{ x: 1060, y: 940 }, { x: 420, y: 420 }],
  },
];

export const PAL_RIVAL: Partial<Skin> = { body: '#8E939B', paw: '#7A7F88', tailTip: '#B9BEC6', muzzle: '#C6CBD3', collar: '#4E5661', ears: 'floppy' };
export const PAL_BARB: Partial<Skin> = { body: '#7A5232', paw: '#6B4528', tailTip: '#5A3A20', muzzle: '#8A6238', collar: '#3A3530', ears: 'floppy', spiked: true, angry: true, eyes: '#F2C94C', scar: true };

export const THEME: Record<string, { ground: string; fence: string; fence2: string; grass1: string; grass2: string }> = {
  grass: { ground: '#A9C684', fence: '#9C7A4E', fence2: '#7C5E3A', grass1: 'rgba(122,152,82,.16)', grass2: 'rgba(214,228,160,.14)' },
  asphalt: { ground: '#98938C', fence: '#B0AA9E', fence2: '#8A8478', grass1: 'rgba(120,116,108,.14)', grass2: 'rgba(190,186,178,.12)' },
  dirt: { ground: '#C9B27E', fence: '#A08050', fence2: '#7E643C', grass1: 'rgba(160,130,70,.18)', grass2: 'rgba(226,204,150,.16)' },
};

export const APP_VER = '2.0.0';
