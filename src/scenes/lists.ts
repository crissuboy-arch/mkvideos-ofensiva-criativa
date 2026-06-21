// Cenas de lista: bullets (pontos), cards (cartões lado a lado), steps (passos).

import type { SceneModule, SceneCtx } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { esc, idsel as q, px } from './util.js';
import { EASE } from '../engine/motion.js';

function header(s: SceneSpec, p: string): string {
  const kicker = s.eyebrow ? `<div class="kicker" id="${p}-k">${esc(s.eyebrow)}</div>` : '';
  const h = s.title ? `<h2 class="h2 left" id="${p}-h">${esc(s.title)}</h2>` : '';
  return kicker + h;
}
function headerAnim(s: SceneSpec, { m, at, p }: SceneCtx): string[] {
  const a: string[] = [];
  if (s.eyebrow) a.push(m.reveal(q(p, 'k'), at(0.2), { y: -16, d: 0.5, ease: EASE.soft }));
  if (s.title) a.push(m.reveal(q(p, 'h'), at(0.45), { x: -28, d: 0.6 }));
  return a;
}

export const bullets: SceneModule = {
  type: 'bullets',
  css: (vertical) => `
      .bullets{list-style:none;margin:${vertical ? 40 : 30}px 0 0;display:flex;flex-direction:column;gap:${vertical ? 26 : 22}px;width:100%;max-width:${vertical ? 900 : 1200}px}
      .bullets li{display:flex;align-items:center;gap:20px;font-family:Inter,system-ui;font-size:${px(vertical, 38, 34)}px;color:var(--fg);font-weight:500}
      .bdot{width:16px;height:16px;flex:none;border-radius:4px;background:var(--accent);box-shadow:0 0 12px var(--accent);transform:rotate(45deg)}`,
  html(s, { p }) {
    const items = (s.bullets ?? []).map((b, i) =>
      `<li id="${p}-b${i}"><span class="bdot"></span>${esc(b)}</li>`).join('\n        ');
    return `${header(s, p)}
      <ul class="bullets">
        ${items}
      </ul>`;
  },
  anim(s, ctx) {
    const { m, at, p } = ctx;
    const a = headerAnim(s, ctx);
    const sels = (s.bullets ?? []).map((_, i) => q(p, `b${i}`));
    if (sels.length) {
      a.push(m.reveal(sels, at(1.1), { x: -24, d: 0.5, stagger: 0.16, ease: EASE.soft }));
      a.push(m.pulse(`${q(p, 'b0')} .bdot`, at(2.8), { times: 2 }));
    }
    return a;
  },
};

export const cards: SceneModule = {
  type: 'cards',
  css: (vertical) => `
      .cards-grid{display:flex;${vertical ? 'flex-direction:column;' : ''}gap:${vertical ? 24 : 34}px;justify-content:center;align-items:stretch;width:100%;max-width:${vertical ? 920 : 1500}px;margin-top:${vertical ? 36 : 30}px}
      .card{flex:1;background:var(--bg2);border:1px solid var(--bg3);border-radius:20px;padding:${vertical ? 32 : 40}px;display:flex;flex-direction:column;gap:12px}
      .card-h{font-family:Sora,system-ui;font-weight:700;font-size:${px(vertical, 40, 38)}px;color:var(--accent);letter-spacing:-1px}
      .card-d{font-family:Inter,system-ui;font-size:${px(vertical, 30, 27)}px;color:var(--muted);line-height:1.45}`,
  html(s, { p }) {
    const cs = (s.cards ?? []).map((c, i) =>
      `<div class="card" id="${p}-c${i}"><div class="card-h">${esc(c.title)}</div>${c.desc ? `<div class="card-d">${esc(c.desc)}</div>` : ''}</div>`).join('\n        ');
    return `${header(s, p)}
      <div class="cards-grid">
        ${cs}
      </div>`;
  },
  anim(s, ctx) {
    const { m, at, p } = ctx;
    const a = headerAnim(s, ctx);
    const sels = (s.cards ?? []).map((_, i) => q(p, `c${i}`));
    if (sels.length) {
      a.push(m.reveal(sels, at(1.0), { y: 36, scale: 0.92, d: 0.55, stagger: 0.18, ease: EASE.pop }));
      a.push(m.float(q(p, 'c0'), at(2.6), { dist: 8 }));
    }
    return a;
  },
};

export const steps: SceneModule = {
  type: 'steps',
  css: (vertical) => `
      .steps{display:flex;flex-direction:column;gap:${vertical ? 22 : 20}px;width:100%;max-width:${vertical ? 920 : 1300}px;margin-top:${vertical ? 36 : 28}px}
      .step{display:flex;align-items:flex-start;gap:24px}
      .step-n{flex:none;width:${vertical ? 64 : 58}px;height:${vertical ? 64 : 58}px;border-radius:50%;background:var(--accent);color:var(--bg);font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 32, 28)}px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(var(--accent-rgb),.4)}
      .step-body{display:flex;flex-direction:column;gap:4px;padding-top:4px}
      .step-h{font-family:Sora,system-ui;font-weight:700;font-size:${px(vertical, 36, 32)}px;color:var(--fg);letter-spacing:-1px}
      .step-d{font-family:Inter,system-ui;font-size:${px(vertical, 28, 25)}px;color:var(--muted);line-height:1.4}`,
  html(s, { p }) {
    const st = (s.steps ?? []).map((x, i) =>
      `<div class="step" id="${p}-st${i}"><div class="step-n">${i + 1}</div><div class="step-body"><div class="step-h">${esc(x.title)}</div>${x.desc ? `<div class="step-d">${esc(x.desc)}</div>` : ''}</div></div>`).join('\n        ');
    return `${header(s, p)}
      <div class="steps">
        ${st}
      </div>`;
  },
  anim(s, ctx) {
    const { m, at, p } = ctx;
    const a = headerAnim(s, ctx);
    const sels = (s.steps ?? []).map((_, i) => q(p, `st${i}`));
    if (sels.length) {
      a.push(m.reveal(sels, at(1.0), { x: -30, d: 0.5, stagger: 0.2, ease: EASE.soft }));
      a.push(m.pulse(`${q(p, `st${sels.length - 1}`)} .step-n`, at(2.8), { times: 2 }));
    }
    return a;
  },
};
