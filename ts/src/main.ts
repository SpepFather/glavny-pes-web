// Точка входа: инициализация всех подсистем, привязка меню, запуск цикла — перенос 1:1
import './mp';
import { initDiag } from './diag';
import { $ } from './types';
import { SAVE, qSetting, state, lang, setLang, skinIdx, diffKey, mapKey, setMapKey, setDiffKey, LN, mapGeom, clouds } from './state';
import { buildMap, computeBlocked, bakeMap, bakeTop, mkCloud } from './world';
import { applyLang, updateSkinUI, skinShift, drawSkinPreview } from './ui';
import { initAudio, toggleSound, applyMuteIcons, applyVol, setVol, setMusicVol, musicGain, vibr, setVibr, getActx } from './audio';
import { persist, startGame, tryStart, exitToMenu, openSettings, closeSettings, showAch, doShare, showTut, renderTut, finishTut, frame, resize, setQuality, pauseGame, resumeGame, resetWorld, cv } from './game';
import { bindInput } from './input';
import { toast, toastOnce } from './fx';
import { initTelegram, initDiscord, IS_DISCORD, initPWA, showDiscordBadge, TMA } from './platform';
import { APP_VER } from './config';
import { updatePlayerName } from './state';

initDiag();

// ---------- tg-guard: Telegram-скрипт только вне Discord ----------
if (!(/[?&]frame_id=/.test(location.search) || /(^|\.)discordsays\.com$/.test(location.hostname))) {
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.async = false;
  document.head.appendChild(s);
}

// ---------- запуск ----------
applyMuteIcons();
($('verTag') as HTMLElement).textContent = 'v' + APP_VER;
($('verTag2') as HTMLElement).textContent = 'v' + APP_VER;

initTelegram();
if (IS_DISCORD) initDiscord();
showDiscordBadge();
initPWA();

applyLang();
updateSkinUI();
buildMap();
computeBlocked();
bakeMap();
bakeTop();
for (let i = 0; i < 2; i++) clouds.push(mkCloud());
resetWorld();
bakeMap(); bakeTop(); // перезапечь после resetWorld (финальная карта)
resize();
requestAnimationFrame(frame);

// ---------- кнопки меню ----------
$('btnPlay').addEventListener('click', tryStart);
$('btnAgain').addEventListener('click', tryStart);
$('btnMenuEnd').addEventListener('click', exitToMenu);
$('btnResume').addEventListener('click', resumeGame);
$('btnRestart').addEventListener('click', startGame);
$('btnMenuPause').addEventListener('click', exitToMenu);
$('btnSet').addEventListener('click', () => openSettings('title'));
$('btnSetPause').addEventListener('click', () => openSettings('pause'));
$('btnSetBack').addEventListener('click', closeSettings);
$('btnTutReplay').addEventListener('click', () => showTut(0));
$('btnTutNext').addEventListener('click', () => {
  // логика перенесена из game.ts: индекс хранится там же
  (window as unknown as { __tutNext?: () => void }).__tutNext?.();
});
$('btnTutSkip').addEventListener('click', () => (window as unknown as { __tutSkip?: () => void }).__tutSkip?.());
$('btnSound').addEventListener('click', () => { initAudio(); toggleSound(); });
$('btnPause').addEventListener('click', () => { state.mode === 'play' ? pauseGame() : resumeGame(); });
$('btnPause').addEventListener('touchstart', e => { // на мобильных — мгновенно
  e.preventDefault(); e.stopPropagation(); initAudio();
  if (state.mode === 'play') pauseGame(); else if (state.mode === 'pause') resumeGame();
}, { passive: false } as AddEventListenerOptions);
$('skinLeft').addEventListener('click', e => { skinShift(-1); (e.currentTarget as HTMLElement).blur(); });
$('skinRight').addEventListener('click', e => { skinShift(1); (e.currentTarget as HTMLElement).blur(); });
$('skinPrev').addEventListener('click', () => skinShift(1));

// достижения и «Поделиться»
$('btnAch').addEventListener('click', showAch);
$('btnAchBack').addEventListener('click', () => { $('screenAch').classList.add('hidden') });
$('btnShare').addEventListener('click', doShare);

// громкость
const volSlider = $('volSlider') as HTMLInputElement, volVal = $('volVal') as HTMLElement;
const volNum = Number(SAVE.vol ?? 80); volSlider.value = String(volNum); (window as unknown as { __gp_vol?: number }).__gp_vol = volNum;
volVal.textContent = volSlider.value + '%';
volSlider.addEventListener('input', () => {
  setVol(Number(volSlider.value) | 0);
  (window as unknown as { __gp_vol?: number }).__gp_vol = Number(volSlider.value) | 0;
  volVal.textContent = volSlider.value + '%';
  applyVol(); persist();
});

// музыка
const musSlider = $('musSlider') as HTMLInputElement, musVal = $('musVal') as HTMLElement;
const musNum = Number(SAVE.mvol ?? 40); musSlider.value = String(musNum); (window as unknown as { __gp_mvol?: number }).__gp_mvol = musNum;
musVal.textContent = musSlider.value + '%';
musSlider.addEventListener('input', () => {
  setMusicVol(Number(musSlider.value) | 0);
  (window as unknown as { __gp_mvol?: number }).__gp_mvol = Number(musSlider.value) | 0;
  musVal.textContent = musSlider.value + '%';
  if (musicGain) if (musicGain) musicGain.gain.setTargetAtTime((Number(musSlider.value) | 0) / 100 * .30, getActx()?.currentTime ?? 0, .05);
  persist();
});

// вибрация
const vibBtn = $('vibBtn') as HTMLElement;
(window as unknown as { getVibr: () => boolean }).getVibr = () => vibr;
(window as unknown as { setVibr: (v: boolean) => void }).setVibr = (v: boolean) => setVibr(v);
(window as unknown as { __gp_vib?: boolean }).__gp_vib = vibr;
function applyVibBtn(): void {
  const on = vibr;
  vibBtn.textContent = on ? LN().ui.vibOn : LN().ui.vibOff;
  vibBtn.classList.toggle('on', on);
}
(window as unknown as { applyVibBtn: () => void }).applyVibBtn = applyVibBtn;
vibBtn.addEventListener('click', () => {
  const wasOn = vibr;
  setVibr(!wasOn);
  (window as unknown as { __gp_vib?: boolean }).__gp_vib = !wasOn;
  applyVibBtn();
  if (!wasOn) import('./audio').then(m => m.vib(30, 'light'));
  persist(); vibBtn.blur();
});
applyVibBtn();

// графика
document.querySelectorAll('.gfxBtn').forEach(b => {
  b.classList.toggle('on', (b as HTMLElement).dataset.q === qSetting);
  b.addEventListener('click', () => {
    (window as unknown as { __gp_q?: string }).__gp_q = (b as HTMLElement).dataset.q;
    document.querySelectorAll('.gfxBtn').forEach(x => x.classList.toggle('on', x === b));
    setQuality(qSetting === 'low' ? 'low' : 'high');
    persist(); (b as HTMLElement).blur?.();
    toastOnce('gfx', 1, LN().ui.gfx + ': ' + (b as HTMLElement).textContent, 'slate');
  });
});

// язык
document.querySelectorAll('.langBtn[data-l]').forEach(b => {
  b.addEventListener('click', () => {
    setLang((b as HTMLElement).dataset.l as 'ru' | 'en' | 'zh' | 'es'); persist(); applyLang();
    toastOnce('lang', 1, LN().ui.language + ': ' + (b as HTMLElement).textContent, 'slate');
  });
});

// кличка
const nameInput = $('nameInput') as HTMLInputElement;
nameInput.value = SAVE.name || '';
updatePlayerName(SAVE.name || '');
nameInput.addEventListener('input', () => {
  updatePlayerName((nameInput.value.trim() || LN().defName).slice(0, 12));
  persist();
});

// сложность
document.querySelectorAll('.optBtn[data-d]').forEach(b => {
  if ((b as HTMLElement).dataset.d === diffKey) {
    document.querySelectorAll('.optBtn[data-d]').forEach(x => x.classList.toggle('on', x === b));
  }
  b.addEventListener('click', () => {
    setDiffKey((b as HTMLElement).dataset.d as string);
    document.querySelectorAll('.optBtn[data-d]').forEach(x => x.classList.toggle('on', x === b));
    persist(); (b as HTMLElement).blur?.();
    import('./game').then(g => {
      if (state.mode === 'attract') { }
    });
    toastOnce('diff', 1, LN().tDiff(LN().diffs[diffKey]), 'slate');
  });
});

// карты
document.querySelectorAll('.mapBtn').forEach(b => {
  if ((b as HTMLElement).dataset.m === mapKey) {
    document.querySelectorAll('.mapBtn').forEach(x => x.classList.toggle('on', x === b));
  }
  b.addEventListener('click', () => {
    setMapKey((b as HTMLElement).dataset.m as string);
    document.querySelectorAll('.mapBtn').forEach(x => x.classList.toggle('on', x === b));
    persist(); (b as HTMLElement).blur?.();
    resetWorld(); bakeMap(); bakeTop(); // аттракт-режим сразу на новой карте
    toastOnce('map', 1, LN().tMap(LN().maps[mapKey]), 'slate');
  });
});

// обучение: индексы через window-хуки (game.ts держит состояние)
(window as unknown as { __tutNext?: () => void }).__tutNext = () => {
  import('./game').then(g => g.tutNext());
};
(window as unknown as { __tutSkip?: () => void }).__tutSkip = () => {
  import('./game').then(g => g.tutSkip());
};

// ввод (клавиатура/тач/геймпад)
bindInput(tryStart, closeSettings, exitToMenu, skinShift);

// аудио-окно для mp.ts
(window as unknown as { getVibr: () => boolean }).getVibr = () => vibr;
(window as unknown as { setVibr: (v: boolean) => void }).setVibr = (v: boolean) => setVibr(v);
(window as unknown as { __gp_resetWorld: () => void }).__gp_resetWorld = resetWorld;
type PigeonT = ReturnType<typeof getPigeons>[number]; (window as unknown as { __gp_pigeons?: PigeonT[] }).__gp_pigeons = [];
import { getPigeons } from './state';
setInterval(() => { type PigeonT = ReturnType<typeof getPigeons>[number]; (window as unknown as { __gp_pigeons?: PigeonT[] }).__gp_pigeons = getPigeons(); }, 200);

try { (window as Window & { __diag?: { errs: string[] } }).__diag && (window as unknown as { __diagShow: (m: string, c: string) => void }).__diagShow('CORE OK v2.0.0', '#8CE99A'); } catch (e) { /* noop */ }
