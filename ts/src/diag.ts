// v1.5.4: диагностический оверлей (живой тест в Discord) — перенос 1:1
export interface Diag { boot: number; errs: string[] }
declare global { interface Window { __diag?: Diag; __diagShow?: (msg: string, color?: string) => void } }

const diag: Diag = { boot: 0, errs: [] };
(window as Window).__diag = diag;

export function initDiag(): void {
  const show = (msg: string, color?: string): void => {
    try {
      let d = document.getElementById('__diagBox');
      if (!d) {
        d = document.createElement('div'); d.id = '__diagBox';
        d.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;max-width:95%;pointer-events:none;font:11px/1.35 monospace;background:#1a1713;color:#fff;padding:6px 8px;border:1px solid ' + (color || '#E8A33D') + ';border-radius:8px;white-space:pre-wrap;word-break:break-all';
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = msg; d.style.borderColor = color || '#E8A33D';
    } catch (e) { /* noop */ }
  };
  (window as Window).__diagShow = show;
  window.addEventListener('error', e => {
    diag.errs.push(String(e.message || e));
    show('ERR: ' + (e.message || e) + ' @' + (e.filename || '') + ':' + (e.lineno || 0), '#ff6b6b');
  }, true);
  window.addEventListener('unhandledrejection', e => {
    const r = String((e.reason && e.reason.message) || e.reason || '');
    diag.errs.push(r); show('PROMISE: ' + r, '#ff6b6b');
  });
  show('BOOT v2.0.0…', '#8CE99A');
}
