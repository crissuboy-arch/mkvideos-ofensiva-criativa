// Cenas de imagem real: img (figura em destaque) e imgrow (fileira de imagens).
// As imagens são opcionais: sem arquivo, cai num placeholder premium tipográfico.

import type { SceneModule } from './types.js';
import { esc, idsel as q, px } from './util.js';
import { EASE } from '../engine/motion.js';

export const img: SceneModule = {
  type: 'img',
  css: (vertical) => `
      .figure{position:relative;width:100%;max-width:${vertical ? 880 : 1100}px;aspect-ratio:${vertical ? '4/5' : '16/9'};border-radius:24px;overflow:hidden;border:1px solid var(--bg3);box-shadow:0 30px 90px rgba(0,0,0,.45);margin-top:${vertical ? 20 : 12}px}
      .figure-img{width:100%;height:100%;object-fit:cover;display:block}
      .figure-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg2),var(--bg3));font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 64, 72)}px;color:var(--accent);text-align:center;padding:40px;letter-spacing:-2px}
      .figure-cap{font-family:Inter,system-ui;font-size:${px(vertical, 30, 27)}px;color:var(--muted);text-align:center;margin-top:20px;line-height:1.4}`,
  html(s, { p }) {
    const head = s.title ? `<h2 class="h2 center" id="${p}-h">${esc(s.title)}</h2>` : '';
    const inner = s.image
      ? `<img class="figure-img" src="${esc(s.image)}" alt="" data-layout-ignore>`
      : `<div class="figure-ph">${esc(s.subtitle ?? s.title ?? '◆')}</div>`;
    const cap = s.desc ? `<div class="figure-cap" id="${p}-cap">${esc(s.desc)}</div>` : '';
    return `${head}
      <div class="figure" id="${p}-fig">${inner}</div>
      ${cap}`;
  },
  anim(s, { m, at, p }) {
    const a: string[] = [];
    if (s.title) a.push(m.reveal(q(p, 'h'), at(0.3), { y: 24, d: 0.5, ease: EASE.soft }));
    a.push(m.reveal(q(p, 'fig'), at(0.7), { y: 30, scale: 0.92, d: 0.6, ease: EASE.pop }));
    if (s.desc) a.push(m.reveal(q(p, 'cap'), at(1.3), { y: 14, d: 0.45, ease: EASE.soft }));
    a.push(m.float(q(p, 'fig'), at(2.2), { dist: 8 }));
    return a;
  },
};

export const imgrow: SceneModule = {
  type: 'imgrow',
  css: (vertical) => `
      .imgrow{display:flex;${vertical ? 'flex-direction:column;' : ''}gap:${vertical ? 18 : 26}px;width:100%;max-width:${vertical ? 880 : 1500}px;margin-top:${vertical ? 30 : 26}px;justify-content:center}
      .imgrow-item{flex:1;aspect-ratio:${vertical ? '16/7' : '3/4'};border-radius:18px;overflow:hidden;border:1px solid var(--bg3);box-shadow:0 18px 50px rgba(0,0,0,.4)}
      .imgrow-item img{width:100%;height:100%;object-fit:cover;display:block}
      .imgrow-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg2),var(--bg3));font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 44, 48)}px;color:var(--accent)}`,
  html(s, { p }) {
    const head = s.title ? `<h2 class="h2 center" id="${p}-h">${esc(s.title)}</h2>` : '';
    const imgs = (s.images && s.images.length ? s.images : ['', '', '']).slice(0, vertCount(s.images?.length));
    const items = imgs.map((src, i) =>
      `<div class="imgrow-item" id="${p}-im${i}">${src ? `<img src="${esc(src)}" alt="" data-layout-ignore>` : `<div class="imgrow-ph">${i + 1}</div>`}</div>`).join('\n        ');
    return `${head}
      <div class="imgrow">
        ${items}
      </div>`;
  },
  anim(s, { m, at, p }) {
    const a: string[] = [];
    if (s.title) a.push(m.reveal(q(p, 'h'), at(0.3), { y: 24, d: 0.5, ease: EASE.soft }));
    const n = (s.images && s.images.length) ? s.images.length : 3;
    const sels = Array.from({ length: Math.min(n, 4) }, (_, i) => q(p, `im${i}`));
    a.push(m.reveal(sels, at(0.8), { y: 30, scale: 0.92, d: 0.5, stagger: 0.15, ease: EASE.pop }));
    a.push(m.float(q(p, 'im0'), at(2.5), { dist: 7 }));
    return a;
  },
};

function vertCount(n?: number): number {
  if (!n) return 3;
  return Math.min(Math.max(n, 1), 4);
}
