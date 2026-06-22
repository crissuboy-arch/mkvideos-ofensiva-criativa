// Cenas de texto: title (hook), topic (seção numerada), lead (frase de impacto),
// illus (destaque tipográfico gigante), quote (citação).

import type { SceneModule } from './types.js';
import { esc, idsel as q } from './util.js';
import { EASE } from '../engine/motion.js';

export const title: SceneModule = {
  type: 'title',
  html(s, { p }) {
    const eyebrow = s.eyebrow ? `<div class="eyebrow" id="${p}-ey"><span class="dot"></span>${esc(s.eyebrow)}</div>` : '';
    const sub = s.subtitle
      ? `<p class="subhead" id="${p}-sub">${esc(s.subtitle)}<span class="cursor" id="${p}-cur"></span></p>`
      : `<p class="subhead" id="${p}-sub"><span class="cursor" id="${p}-cur"></span></p>`;
    return `${eyebrow}
      <h1 class="title" id="${p}-h">${esc(s.title ?? '')}</h1>
      <div class="rule" id="${p}-rule"></div>
      ${sub}`;
  },
  anim(s, { m, at, p }) {
    const a = [
      m.reveal(q(p, 'h'), at(0.4), { y: 60, d: 0.75, ease: 'power4.out' }),
      m.sweep(q(p, 'rule'), at(1.0)),
      m.reveal(q(p, 'sub'), at(1.2), { y: 20, d: 0.55, ease: EASE.soft }),
      m.blink(q(p, 'cur'), at(1.6), { times: 14 }),
      m.glow(q(p, 'h'), at(2.2), { blur: 30 }),
    ];
    if (s.eyebrow) a.unshift(m.reveal(q(p, 'ey'), at(0.15), { y: -24, d: 0.5 }));
    return a;
  },
};

export const topic: SceneModule = {
  type: 'topic',
  html(s, { p }) {
    const num = s.index != null ? String(s.index).padStart(2, '0') : '';
    const badge = num ? `<div class="num-badge" id="${p}-num">${num}</div>` : '';
    const desc = s.desc ? `<p class="desc" id="${p}-d">${esc(s.desc)}</p>` : '';
    return `${badge}
      <h2 class="h2" id="${p}-h">${esc(s.title ?? '')}</h2>
      <div class="rule" id="${p}-rule"></div>
      ${desc}`;
  },
  anim(s, { m, at, p }) {
    const a: string[] = [];
    if (s.index != null) a.push(m.reveal(q(p, 'num'), at(0.2), { scale: 0.6, d: 0.55, ease: EASE.pop }));
    a.push(m.reveal(q(p, 'h'), at(0.5), { y: 40, d: 0.65 }));
    a.push(m.sweep(q(p, 'rule'), at(1.0)));
    if (s.desc) a.push(m.reveal(q(p, 'd'), at(1.1), { y: 18, d: 0.5, ease: EASE.soft }));
    // mid-scene activity
    a.push(s.index != null ? m.pulse(q(p, 'num'), at(2.5), { times: 3 }) : m.float(q(p, 'h'), at(2.4), { dist: 8 }));
    return a;
  },
};

export const lead: SceneModule = {
  type: 'lead',
  css: () => `
      .lead-big{font-family:Sora,system-ui;font-weight:800;line-height:1.05;text-align:center;color:var(--fg);letter-spacing:-2px}
      .lead-big .hl{color:var(--accent)}
      .lead-support{font-family:Inter,system-ui;color:var(--muted);text-align:center;line-height:1.5;margin-top:24px}`,
  html(s, { p }) {
    const support = s.desc ? `<p class="lead-support" id="${p}-d">${esc(s.desc)}</p>` : '';
    const eyebrow = s.eyebrow ? `<div class="kicker" id="${p}-k">${esc(s.eyebrow)}</div>` : '';
    return `${eyebrow}
      <div class="lead-big" id="${p}-h">${esc(s.title ?? '')}</div>
      <div class="rule center" id="${p}-rule"></div>
      ${support}`;
  },
  anim(s, { m, at, p }) {
    const a: string[] = [];
    if (s.eyebrow) a.push(m.reveal(q(p, 'k'), at(0.2), { y: -16, d: 0.5, ease: EASE.soft }));
    a.push(m.reveal(q(p, 'h'), at(0.45), { y: 40, d: 0.8, ease: EASE.expo }));
    a.push(m.sweep(q(p, 'rule'), at(1.2)));
    if (s.desc) a.push(m.reveal(q(p, 'd'), at(1.4), { y: 18, d: 0.55, ease: EASE.soft }));
    a.push(m.float(q(p, 'h'), at(2.2), { dist: 7 }));
    return a;
  },
};

export const illus: SceneModule = {
  type: 'illus',
  css: () => `
      .illus-big{font-family:Sora,system-ui;font-weight:800;line-height:.92;text-align:center;color:var(--accent);letter-spacing:-4px;text-shadow:0 0 60px rgba(var(--accent-rgb),.25)}
      .illus-sub{font-family:Inter,system-ui;color:var(--fg);text-align:center;margin-top:18px;font-weight:600}
      .illus-cap{font-family:Inter,system-ui;color:var(--muted);text-align:center;margin-top:8px}`,
  html(s, { p }) {
    const sub = s.subtitle ? `<div class="illus-sub" id="${p}-sub">${esc(s.subtitle)}</div>` : '';
    const cap = s.desc ? `<div class="illus-cap" id="${p}-cap">${esc(s.desc)}</div>` : '';
    return `<div class="illus-big" id="${p}-h">${esc(s.title ?? '')}</div>
      ${sub}${cap}`;
  },
  anim(s, { m, at, p }) {
    const a = [
      m.reveal(q(p, 'h'), at(0.35), { scale: 0.7, d: 0.7, ease: EASE.pop }),
      m.glow(q(p, 'h'), at(1.0), { blur: 40 }),
    ];
    if (s.subtitle) a.push(m.reveal(q(p, 'sub'), at(1.1), { y: 20, d: 0.5, ease: EASE.soft }));
    if (s.desc) a.push(m.reveal(q(p, 'cap'), at(1.4), { y: 14, d: 0.45, ease: EASE.soft }));
    a.push(m.float(q(p, 'h'), at(2.2), { dist: 10 }));
    return a;
  },
};

export const quote: SceneModule = {
  type: 'quote',
  css: () => `
      .quote-mark{font-family:Sora,system-ui;font-weight:800;color:var(--accent);line-height:.6;text-align:center;opacity:.85}
      .quote-text{font-family:Sora,system-ui;font-weight:700;color:var(--fg);text-align:center;line-height:1.25;letter-spacing:-1px;margin-top:6px}
      .quote-author{font-family:Inter,system-ui;color:var(--muted);text-align:center;margin-top:22px;font-weight:600}
      .quote-author::before{content:"— "}`,
  html(s, { p }) {
    const author = s.quote?.author ? `<div class="quote-author" id="${p}-au">${esc(s.quote.author)}</div>` : '';
    return `<div class="quote-mark" id="${p}-qm">&ldquo;</div>
      <div class="quote-text" id="${p}-h">${esc(s.quote?.text ?? s.title ?? '')}</div>
      ${author}`;
  },
  anim(s, { m, at, p }) {
    const a = [
      m.reveal(q(p, 'qm'), at(0.25), { scale: 0.5, d: 0.6, ease: EASE.pop }),
      m.reveal(q(p, 'h'), at(0.6), { y: 30, d: 0.7, ease: EASE.soft }),
    ];
    if (s.quote?.author) a.push(m.reveal(q(p, 'au'), at(1.3), { y: 14, d: 0.5, ease: EASE.soft }));
    a.push(m.float(q(p, 'qm'), at(2.0), { dist: 8 }));
    return a;
  },
};
