// Спрайты: пёс, кот — перенос 1:1 (рисование кодом)
import { TAU, circ, ell } from './types';
import { state } from './state';
import type { Skin } from './config';
import type { DogState, CatState } from './types';

export function drawDog(g: CanvasRenderingContext2D, d: DogState, p: Partial<Skin>): void {
  const sc = (d as { sc?: number }).sc || 1;
  g.save(); g.translate(d.x, d.y); g.scale(sc, sc);
  g.fillStyle = 'rgba(45,38,28,.2)'; ell(g, 2, 6, 15, 11);
  g.rotate(d.a);
  const st = Math.sin(d.phase), st2 = Math.sin(d.phase + Math.PI), amp = d.moving ? 3.2 : 0;
  const leg = (x: number, y: number): void => { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); };
  g.fillStyle = p.paw || '#9C8C74';
  leg(9 + st * amp, -9.5); leg(9 + st2 * amp, 9.5); leg(-7 + st2 * amp, -9.5);
  if (d.peeing) { g.fillStyle = 'rgba(45,38,28,.16)'; ell(g, -1, 9, 4.5, 3); g.fillStyle = p.paw || '#9C8C74'; leg(-3, 4); }
  else leg(-7 + st * amp, 9.5);
  const wag = Math.sin(state.time * (d.excited ? 15 : 7.5) + d.id) * (d.moving ? 2.4 : 3.4);
  const tx = -18.5, ty = wag + (d.peeing ? -.5 : 0);
  if (p.tailLess) { g.fillStyle = p.body || '#B0A189'; circ(g, -14.5, 0, 3.2); }
  else {
    const tr = p.fluffy ? 8.6 : 6.4;
    g.fillStyle = p.body || '#B0A189'; circ(g, tx, ty, tr);
    g.fillStyle = p.tailTip || '#D8CDB4'; circ(g, tx - 1.8, ty - 1.8, p.fluffy ? 4.6 : 2.9);
  }
  g.fillStyle = p.body || '#B0A189'; ell(g, 0, 0, 14.5, 10);
  if (p.saddle) { g.fillStyle = p.saddle; ell(g, -3, -1.5, 9.8, 7.2); }
  if (p.ruff) { g.fillStyle = p.ruff; circ(g, 7.5, 0, 10.2); }
  if (p.chest) { g.fillStyle = p.chest; ell(g, 7.5, 0, 4.6, 6.2); }
  if (p.spots) {
    g.fillStyle = p.spots.col;
    const SP: [number, number, number][] = [[-4, -3.5, 3.4], [3.5, 3, 2.9], [-8.5, .5, 2.5], [5.5, -4.5, 2.3], [.5, -6.5, 2.1], [-6, 4.8, 2.2]];
    for (let i = 0; i < Math.min(p.spots.n, SP.length); i++) circ(g, SP[i][0], SP[i][1], SP[i][2]);
  }
  g.fillStyle = p.body || '#B0A189'; circ(g, 13.5, 0, 8.6);
  if (p.cap) { g.fillStyle = p.cap; ell(g, 13.5, -4, 7.4, 3.8); }
  if (p.mask) { g.fillStyle = p.mask; ell(g, 15.2, 0, 6.2, 6.6); }
  if (p.topknot) {
    g.fillStyle = p.body || '#B0A189'; circ(g, 13.5, 0, 10);
    g.fillStyle = p.paw || '#9C8C74'; circ(g, 11, -3.4, 2.6); circ(g, 15.6, 2.2, 2.4); circ(g, 11.6, 4.2, 2.2);
  }
  if (p.patch) { g.fillStyle = p.patch; circ(g, 15, -4.6, 3.3); }
  if (p.scar) { // шрам через глаз
    g.strokeStyle = '#4A3A28'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(12.6, -6.4); g.lineTo(17.4, -2.4); g.stroke();
  }
  const ec = p.earCol || p.paw || '#9C8C74';
  if (p.ears === 'pointy') {
    const tip = p.bigEars ? 16 : 12.5;
    g.fillStyle = ec;
    g.beginPath(); g.moveTo(9.5, -4); g.lineTo(13, -tip); g.lineTo(16.5, -4.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9.5, 4); g.lineTo(13, tip); g.lineTo(16.5, 4.5); g.closePath(); g.fill();
  } else if (p.ears === 'mixed') {
    g.fillStyle = ec;
    g.beginPath(); g.moveTo(9.5, -4); g.lineTo(13, -12.5); g.lineTo(16.5, -4.5); g.closePath(); g.fill();
    circ(g, 10.5, 7.8, 4.4);
  } else {
    g.fillStyle = ec; circ(g, 10.5, -7.8, 4.4); circ(g, 10.5, 7.8, 4.4);
  }
  g.fillStyle = p.muzzle || '#CFC3A8'; ell(g, 19, 0, 4.6, 4);
  g.fillStyle = '#332C26'; circ(g, 21.4, 0, 1.9);
  g.fillStyle = p.eyes || '#332C26';
  g.beginPath(); g.arc(15, -4.6, 1.15, 0, TAU); g.arc(15, 4.6, 1.15, 0, TAU); g.fill();
  if (p.brows) { g.fillStyle = p.mask || '#F6F1E6'; circ(g, 15, -7.4, 1.5); circ(g, 15, 7.4, 1.5); }
  if (p.angry) { // злые брови
    g.strokeStyle = '#2E2620'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(13.4, -6.8); g.lineTo(16.8, -4.4); g.moveTo(13.4, 6.8); g.lineTo(16.8, 4.4); g.stroke();
  }
  g.strokeStyle = p.collar || '#C4453B'; g.lineWidth = 3.2;
  g.beginPath(); g.arc(6.2, 0, 7.4, -1.25, 1.25); g.stroke();
  if (p.spiked) { // шипастый ошейник
    g.fillStyle = '#EDE6D2';
    for (const t of [-0.85, 0, 0.85]) {
      const a = t;
      circ(g, 6.2 + Math.cos(a) * 7.4, Math.sin(a) * 7.4, 1.7);
    }
  }
  g.restore();
}

export function drawCat(g: CanvasRenderingContext2D, c: CatState): void {
  g.save(); g.translate(c.x, c.y);
  g.fillStyle = 'rgba(45,38,28,.2)'; ell(g, 2, 5, 12, 8);
  g.rotate(c.a + (c.state === 'scratch' ? Math.sin(state.time * 18) * .06 : 0));
  const st = Math.sin(c.phase), st2 = Math.sin(c.phase + Math.PI), amp = c.moving ? 2.6 : 0;
  const leg = (x: number, y: number): void => { g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); };
  g.fillStyle = '#6E7783';
  leg(7 + st * amp, -6.5); leg(7 + st2 * amp, 6.5); leg(-6 + st2 * amp, -6.5); leg(-6 + st * amp, 6.5);
  const wag = Math.sin(state.time * 6 + c.phase * .3) * 4;
  g.strokeStyle = '#7E8794'; g.lineWidth = 4.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(-19, wag * .5, -23, wag - (c.moving ? 2 : 0)); g.stroke();
  g.fillStyle = '#98A2B0'; ell(g, 0, 0, 12.5, 8);
  g.strokeStyle = 'rgba(90,99,113,.75)'; g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(-3, -7.4); g.lineTo(-3, -3.4); g.moveTo(1.5, -7.9); g.lineTo(1.5, -3.6);
  g.moveTo(-3, 7.4); g.lineTo(-3, 3.4); g.moveTo(1.5, 7.9); g.lineTo(1.5, 3.6);
  g.stroke();
  g.fillStyle = '#98A2B0'; circ(g, 10.5, 0, 7.2);
  g.beginPath(); g.moveTo(5.5, -4.5); g.lineTo(7.5, -11.5); g.lineTo(11.5, -4.8); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(5.5, 4.5); g.lineTo(7.5, 11.5); g.lineTo(11.5, 4.8); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(90,99,113,.75)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(9, -6.4); g.lineTo(9, -3.4); g.moveTo(12, -5.6); g.lineTo(12, -3.2); g.stroke();
  if (c.state === 'scratch') {
    g.strokeStyle = '#332C26'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(12.4, -3); g.lineTo(14.6, -2.4); g.moveTo(12.4, 3); g.lineTo(14.6, 2.4); g.stroke();
  } else {
    g.fillStyle = '#6FBF4E'; circ(g, 13.5, -3, 1.4); circ(g, 13.5, 3, 1.4);
  }
  g.fillStyle = '#E8A0A0';
  g.beginPath(); g.moveTo(16.2, -1.3); g.lineTo(18.4, 0); g.lineTo(16.2, 1.3); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,64,58,.6)'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(16.5, -1); g.lineTo(21, -2.6); g.moveTo(16.5, 1); g.lineTo(21, 2.6);
  g.stroke();
  if (c.state === 'scratch') {
    g.fillStyle = '#6E7783';
    circ(g, 11, -7 + Math.sin(state.time * 20) * 3, 3.2);
  }
  g.restore();
}
