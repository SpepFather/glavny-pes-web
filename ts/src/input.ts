// Ввод: клавиатура, тач-джойстик, геймпад, кнопки действий — перенос 1:1
import { IS_TOUCH } from './types';
import { state, setState } from './state';
import { initAudio, startMusic } from './audio';
import { pauseGame, resumeGame } from './game';

export const key: Record<string, boolean> = {};
export const input = { space: false, btn: false, bark: false };
export const joy = { on: false, id: null as number | null, ax: 0, ay: 0, vx: 0, vy: 0 };

// ---------- геймпад ----------
export const PAD = { ax: 0, ay: 0, pee: false, barkPrev: false, startPrev: false };
export function pollPad(): void {
  let gp: Gamepad | null = null;
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) { if (p && p.connected) { gp = p; break; } }
  } catch (e) { /* noop */ }
  if (!gp) { PAD.ax = PAD.ay = 0; PAD.pee = false; return; }
  const dz = (v: number): number => Math.abs(v) > .22 ? v : 0;
  PAD.ax = dz(gp.axes[0] || 0); PAD.ay = dz(gp.axes[1] || 0);
  PAD.pee = !!((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed));
  const bark = !!((gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[5] && gp.buttons[5].pressed));
  if (bark && !PAD.barkPrev) input.bark = true;
  PAD.barkPrev = bark;
  const st = !!(gp.buttons[9] && gp.buttons[9].pressed);
  if (st && !PAD.startPrev) {
    if (state.mode === 'play') pauseGame();
    else if (state.mode === 'pause') resumeGame();
  }
  PAD.startPrev = st;
}

export function bindInput(tryStart: () => void, closeSettings: () => void, exitToMenu: () => void, skinShift: (d: number) => void): void {
  const nameInput = document.getElementById('nameInput') as HTMLInputElement;
  addEventListener('keydown', e => {
    if (document.activeElement === nameInput) {
      if (e.code === 'Enter') { nameInput.blur(); tryStart(); }
      else if (e.code === 'Escape') nameInput.blur();
      return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    initAudio();
    key[e.code] = true;
    if (e.code === 'Space') input.space = true;
    if (e.repeat) return;
    if (e.code === 'KeyM') import('./audio').then(m => m.toggleSound());
    if (e.code === 'KeyE') { input.bark = true; }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!(document.getElementById('screenSet') as HTMLElement).classList.contains('hidden')) closeSettings();
      else if (state.mode === 'play') pauseGame();
      else if (state.mode === 'pause') resumeGame();
      else if (state.mode === 'end' && e.code === 'Escape') exitToMenu();
    }
    if (e.code === 'Enter' && (state.mode === 'attract' || state.mode === 'end')) tryStart();
    if (e.code === 'KeyR' && state.mode !== 'attract') import('./game').then(m => m.startGame());
    if (state.mode === 'attract') {
      if (e.code === 'ArrowLeft') skinShift(-1);
      if (e.code === 'ArrowRight') skinShift(1);
    }
  });
  addEventListener('keyup', e => {
    key[e.code] = false;
    if (e.code === 'Space') input.space = false;
  });
  addEventListener('pointerdown', () => { initAudio(); startMusic(); }, { once: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  // HUD-кнопки действий
  const peeBtn = document.getElementById('peeBtn') as HTMLElement;
  peeBtn.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); input.btn = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
    peeBtn.addEventListener(ev, () => input.btn = false);
  (document.getElementById('barkBtn') as HTMLElement).addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); input.bark = true; });

  // ---------- сенсорное управление ----------
  if (IS_TOUCH) document.body.classList.add('touch');
  const cv = document.getElementById('game') as HTMLElement;
  cv.addEventListener('touchstart', e => {
    e.preventDefault(); initAudio();
    document.body.classList.add('touch');
    for (const t of Array.from(e.changedTouches)) {
      if (joy.id === null) {
        joy.id = t.identifier; joy.on = true; joy.ax = t.clientX; joy.ay = t.clientY; joy.vx = 0; joy.vy = 0;
        const jb = document.getElementById('joyBase') as HTMLElement, js = document.getElementById('joyStick') as HTMLElement;
        jb.style.display = js.style.display = 'block';
        jb.style.left = (t.clientX - 58) + 'px'; jb.style.top = (t.clientY - 58) + 'px';
        js.style.left = (t.clientX - 26) + 'px'; js.style.top = (t.clientY - 26) + 'px';
      }
    }
  }, { passive: false } as AddEventListenerOptions);
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joy.id) continue;
      let dx = t.clientX - joy.ax, dy = t.clientY - joy.ay;
      const d = Math.hypot(dx, dy), m = Math.min(d, 48);
      if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
      joy.vx = dx / 48; joy.vy = dy / 48;
      (document.getElementById('joyStick') as HTMLElement).style.left = (joy.ax + dx - 26) + 'px';
      (document.getElementById('joyStick') as HTMLElement).style.top = (joy.ay + dy - 26) + 'px';
    }
  }, { passive: false } as AddEventListenerOptions);
  const endTouch = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joy.id) {
        joy.id = null; joy.on = false; joy.vx = joy.vy = 0;
        (document.getElementById('joyBase') as HTMLElement).style.display = (document.getElementById('joyStick') as HTMLElement).style.display = 'none';
      }
    }
  };
  cv.addEventListener('touchend', endTouch);
  cv.addEventListener('touchcancel', endTouch);
  document.addEventListener('gesturestart', e => e.preventDefault());
}
