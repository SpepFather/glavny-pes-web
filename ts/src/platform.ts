// Платформы: Telegram WebApp, Discord Activity SDK, PWA — перенос 1:1
import { TAU, ell } from './types';
import { setLang, setSkinIdx, skinIdx, mapKey, diffKey, lang, LN, SAVE } from './state';
import { applyLang } from './ui';
import { initAudio } from './audio';

interface TelegramWebApp {
  ready?: () => void; expand?: () => void; disableVerticalSwipes?: () => void;
  requestFullscreen?: () => void; setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void;
  CloudStorage?: { setItem?: (k: string, v: string) => void };
  initDataUnsafe?: { start_param?: string };
}
declare global { interface Window { __mpReady?: boolean; __skipTG?: number } }

type TGWin = { WebApp?: { HapticFeedback?: { impactOccurred: (s: string) => void }; ready?: () => void; expand?: () => void; disableVerticalSwipes?: () => void; requestFullscreen?: () => void; setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void; CloudStorage?: { setItem?: (k: string, v: string) => void }; initDataUnsafe?: { start_param?: string } } };
export const TMA: TelegramWebApp | null = (() => { try { const tg = (window as { Telegram?: TGWin }).Telegram; return (tg && tg.WebApp) ? tg.WebApp as unknown as TelegramWebApp : null } catch (e) { return null } })();

export const IS_DISCORD: boolean = (() => { try { return /(^|\.)discordsays\.com$/.test(location.hostname) || /[?&]frame_id=/.test(location.search) } catch (e) { return false } })();
export const DC_APP_ID = '1573411949725753565';

export function dcRoomCode(iid: string): string { // instance_id -> детерминированный код комнаты
  let h = 2166136261; const s = String(iid);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let x = h % 331776, c = '';
  for (let i = 0; i < 4; i++) { c += A[x % 24]; x = Math.floor(x / 24); }
  return c;
}

export async function initDiscord(): Promise<void> {
  const D = (m: string): void => { try { (window as Window & { __diagShow?: (m: string, c: string) => void }).__diagShow?.(m, '#59C0FF') } catch (e) { /* noop */ } };
  try {
    D('DC: import SDK…');
        // @ts-ignore — vendored SDK без .d.ts
    const sdk = await import('../public/discord-sdk.mjs');
    D('DC: ready…');
    interface DiscordSDKLike { ready(): Promise<void>; instanceId?: string; commands: { authorize(o: Record<string, unknown>): Promise<{ code: string }>; authenticate(o: { access_token: string }): Promise<{ user?: { global_name?: string; username?: string } }> } }
    const ds = new (sdk as { DiscordSDK: new (id: string) => DiscordSDKLike }).DiscordSDK(DC_APP_ID);
    await ds.ready();
    D('DC: authorize…');
    const { code } = await ds.commands.authorize({ client_id: DC_APP_ID, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'guilds', 'applications.commands'] });
    D('DC: token…');
    const tr = await fetch('/discord/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const tj = await tr.json() as { ok?: boolean; error?: string; access_token?: string };
    if (!tj.ok) throw new Error(tj.error || 'token');
    D('DC: authenticate…');
    const auth = await ds.commands.authenticate({ access_token: tj.access_token as string });
    if (!auth || !auth.user) throw new Error('auth');
    const un = String(auth.user.global_name || auth.user.username || '').trim() || 'Бобик';
    try {
      SAVE.name = un.slice(0, 12);
      (document.getElementById('nameInput') as HTMLInputElement).value = SAVE.name;
    } catch (e) { /* noop */ }
    const iid = ds.instanceId || new URLSearchParams(location.search).get('instance_id') || '';
    const rc = iid ? dcRoomCode(iid) : '';
    D('DC: OK, room ' + rc);
    if (rc && /^[A-Z0-9]{4}$/.test(rc)) {
      const tryJoin = (nn: number): void => { // ждём загрузки мультиплеера
        if (!window.__mpReady) { if (nn > 0) setTimeout(() => tryJoin(nn - 1), 300); return; }
        import('./mp').then(MP => { MP.MP.openLobby(); setTimeout(() => MP.MP.join(rc), 400); });
      };
      tryJoin(20);
    }
  } catch (e) {
    console.warn('Discord init:', (e && (e as Error).message) || e);
    try { (window as Window & { __diagShow?: (m: string, c: string) => void }).__diagShow?.('DC ERR: ' + ((e && (e as Error).message) || e), '#ff6b6b') } catch (_) { /* noop */ }
    try { import('./fx').then(m => m.toast('Discord: ' + ((e && (e as Error).message) || 'ошибка авторизации'), 'red')) } catch (_) { /* noop */ }
  }
}

export function initTelegram(): void {
  if (TMA) {
    try { TMA.ready?.() } catch (e) { /* noop */ }
    try { TMA.expand?.() } catch (e) { /* noop */ }
    try { TMA.disableVerticalSwipes?.() } catch (e) { /* noop */ }
    try { TMA.requestFullscreen?.() } catch (e) { /* noop */ }
    try { TMA.setHeaderColor?.('#2E2A26') } catch (e) { /* noop */ }
    try { TMA.setBackgroundColor?.('#2E2A26') } catch (e) { /* noop */ }
  }
}

export function showDiscordBadge(): void {
  if (!IS_DISCORD) return;
  try {
    const b = document.createElement('div'); b.textContent = 'DISCORD ACTIVITY';
    b.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:999;font:700 10px sans-serif;letter-spacing:1px;color:#8CE99A;background:rgba(40,36,31,.85);border:1px solid #8CE99A;border-radius:10px;padding:3px 10px;pointer-events:none';
    document.documentElement.appendChild(b); setTimeout(() => b.remove(), 6000);
  } catch (e) { /* noop */ }
}

// ---------- PWA: манифест на лету + service worker ----------
export function initPWA(): void {
  try {
    if (location.protocol === 'https:' || location.hostname === 'localhost') {
      const mkIcon = (s: number): string => {
        const c = document.createElement('canvas'); c.width = c.height = s;
        const g = c.getContext('2d') as CanvasRenderingContext2D, u = s / 24;
        g.fillStyle = '#2E2A26'; g.fillRect(0, 0, s, s);
        g.fillStyle = '#E8A33D';
        ell(g, 12 * u, 16 * u, 5.2 * u, 4.2 * u);
        [[6.6, 10.6, 2.2], [10.6, 7.6, 2.2], [14.6, 7.6, 2.2], [18.2, 10.6, 2.2]].forEach(p => {
          g.beginPath(); g.arc(p[0] * u, p[1] * u, p[2] * u, 0, TAU); g.fill();
        });
        return c.toDataURL('image/png');
      };
      const base = location.href.replace(/[^/]*$/, '');
      const man = { name: 'Главный пёс', short_name: 'Главный пёс', start_url: base, scope: base, display: 'fullscreen', orientation: 'landscape', background_color: '#2E2A26', theme_color: '#2E2A26', icons: [{ src: mkIcon(192), sizes: '192x192', type: 'image/png' }, { src: mkIcon(512), sizes: '512x512', type: 'image/png' }] };
      const lm = document.createElement('link'); lm.rel = 'manifest';
      lm.href = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }));
      document.head.appendChild(lm);
      if (!IS_DISCORD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* noop */ });
    }
  } catch (e) { /* noop */ }
}

export { setLang, setSkinIdx, skinIdx, mapKey, diffKey, lang, LN, initAudio, applyLang };
