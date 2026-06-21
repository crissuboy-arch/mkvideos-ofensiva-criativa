// Cenas de venda/fecho: offer (oferta com preço/bônus/urgência) e cta (marca).

import type { SceneModule } from './types.js';
import { esc, idsel as q, px, hexToRgb } from './util.js';
import { EASE } from '../engine/motion.js';

export const offer: SceneModule = {
  type: 'offer',
  css: (vertical) => `
      .offer-card{background:var(--bg2);border:1px solid var(--accent);border-radius:24px;padding:${vertical ? 40 : 48}px ${vertical ? 44 : 64}px;display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 30px 90px rgba(0,0,0,.4);max-width:${vertical ? 880 : 1100}px;width:100%}
      .offer-was{font-family:Inter,system-ui;font-size:${px(vertical, 36, 34)}px;color:var(--muted);text-decoration:line-through}
      .offer-price{font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 110, 128)}px;color:var(--accent);line-height:1;letter-spacing:-4px}
      .offer-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-top:8px}
      .offer-list li{font-family:Inter,system-ui;font-size:${px(vertical, 30, 28)}px;color:var(--fg);display:flex;gap:12px;align-items:center}
      .offer-list li::before{content:"\\2713";color:var(--accent);font-weight:700}
      .offer-urgency{font-family:'JetBrains Mono',monospace;font-size:${px(vertical, 26, 24)}px;color:var(--bg);background:var(--accent);padding:10px 22px;border-radius:999px;font-weight:700;letter-spacing:.05em;margin-top:8px}`,
  html(s, { p }) {
    const o = s.offer ?? {};
    const head = s.title ? `<h2 class="h2 center" id="${p}-h">${esc(s.title)}</h2>` : '';
    const was = o.was ? `<div class="offer-was" id="${p}-was">${esc(o.was)}</div>` : '';
    const price = o.price ? `<div class="offer-price" id="${p}-price">${esc(o.price)}</div>` : '';
    const items = (o.items ?? []).length
      ? `<ul class="offer-list" id="${p}-list">${(o.items ?? []).map((it) => `<li>${esc(it)}</li>`).join('')}</ul>` : '';
    const urgency = o.urgency ? `<div class="offer-urgency" id="${p}-urg">${esc(o.urgency)}</div>` : '';
    return `${head}
      <div class="offer-card" id="${p}-card">
        ${was}${price}${items}${urgency}
      </div>`;
  },
  anim(s, { m, at, p, brand }) {
    const rgb = hexToRgb(brand.palette.accent);
    const o = s.offer ?? {};
    const a: string[] = [];
    if (s.title) a.push(m.reveal(q(p, 'h'), at(0.3), { y: 24, d: 0.5, ease: EASE.soft }));
    a.push(m.reveal(q(p, 'card'), at(0.6), { y: 34, scale: 0.92, d: 0.6, ease: EASE.pop }));
    if (o.was) a.push(m.reveal(q(p, 'was'), at(1.0), { y: 10, d: 0.4, ease: EASE.soft }));
    if (o.price) {
      a.push(m.reveal(q(p, 'price'), at(1.15), { scale: 0.7, d: 0.6, ease: EASE.pop }));
      a.push(m.glow(q(p, 'price'), at(1.8), { blur: 36, color: rgb }));
    }
    if ((o.items ?? []).length) a.push(m.reveal(q(p, 'list'), at(1.5), { y: 16, d: 0.5, ease: EASE.soft }));
    if (o.urgency) a.push(m.pulse(q(p, 'urg'), at(2.4), { times: 3 }));
    return a;
  },
};

export const cta: SceneModule = {
  type: 'cta',
  css: (vertical) => `
      .oc-eyebrow{font-family:'JetBrains Mono',monospace;font-size:${px(vertical, 28, 24)}px;font-weight:600;color:var(--muted);letter-spacing:.32em;text-align:center;text-transform:uppercase}
      .oc-brand{font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 100, 110)}px;line-height:1.0;text-align:center;letter-spacing:-2px;margin:12px 0}
      .oc-b1{color:var(--fg)}.oc-b2{color:var(--accent)}
      .oc-slogan{font-family:Inter,system-ui;font-size:${px(vertical, 34, 30)}px;color:var(--muted);text-align:center;line-height:1.45;margin-top:8px}
      .oc-handle{font-family:Inter,system-ui;font-size:${px(vertical, 38, 32)}px;font-weight:600;color:var(--accent);text-align:center;margin-top:18px}
      .oc-site{font-family:'JetBrains Mono',monospace;font-size:${px(vertical, 28, 24)}px;color:var(--muted);text-align:center;margin-top:8px}`,
  html(_s, { p, brand }) {
    const [word1, ...rest] = brand.name.split(' ');
    const word2 = rest.join(' ');
    const brandHtml = word2
      ? `<span class="oc-b1">${esc(word1)}</span><br><span class="oc-b2">${esc(word2)}</span>`
      : `<span class="oc-b2">${esc(word1)}</span>`;
    return `<div class="oc-eyebrow" id="${p}-eye">${esc(brand.tagline.toUpperCase())}</div>
      <div class="oc-brand" id="${p}-brand">${brandHtml}</div>
      <div class="rule center" id="${p}-rule"></div>
      <p class="oc-slogan" id="${p}-sl">${esc(brand.slogan)}</p>
      <div class="oc-handle" id="${p}-hdl">${esc(brand.instagram)}</div>
      <div class="oc-site mono" id="${p}-url">${esc(brand.site)}</div>
      <div class="reg tl" id="${p}-r1"></div><div class="reg br" id="${p}-r2"></div>`;
  },
  anim(_s, { m, at, p, brand }) {
    const rgb = hexToRgb(brand.palette.accent);
    return [
      m.reveal(q(p, 'eye'), at(0.2), { y: -18, d: 0.5, ease: EASE.soft }),
      m.reveal(q(p, 'brand'), at(0.5), { scale: 0.7, d: 0.7, ease: 'back.out(1.7)' }),
      m.sweep(q(p, 'rule'), at(1.1), { d: 0.6 }),
      m.reveal(q(p, 'sl'), at(1.3), { y: 20, d: 0.55, ease: EASE.soft }),
      m.reveal(q(p, 'hdl'), at(1.6), { y: 16, d: 0.5, ease: EASE.soft }),
      m.reveal(q(p, 'url'), at(1.8), { y: 12, d: 0.45 }),
      m.glow(q(p, 'brand'), at(1.4), { color: rgb }),
      m.reveal([q(p, 'r1'), q(p, 'r2')], at(0.6), { scale: 0.5, d: 0.6, stagger: 0.12, ease: 'back.out(2)' }),
    ];
  },
};
