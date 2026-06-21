// Cenas de dado: term (termo+definição), compare (A vs B), proof (números/prova).

import type { SceneModule } from './types.js';
import { esc, idsel as q, px } from './util.js';
import { EASE } from '../engine/motion.js';

export const term: SceneModule = {
  type: 'term',
  css: (vertical) => `
      .term-word{font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 96, 110)}px;color:var(--accent);text-align:center;letter-spacing:-3px;line-height:1}
      .term-pos{font-family:'JetBrains Mono',monospace;font-size:${px(vertical, 24, 22)}px;color:var(--muted);text-align:center;letter-spacing:.2em;text-transform:uppercase;margin-top:10px}
      .term-def{font-family:Inter,system-ui;font-size:${px(vertical, 36, 32)}px;color:var(--fg);text-align:center;line-height:1.45;max-width:${vertical ? 900 : 1200}px;margin-top:24px}`,
  html(s, { p }) {
    const pos = s.eyebrow ? `<div class="term-pos" id="${p}-pos">${esc(s.eyebrow)}</div>` : '';
    return `<div class="term-word" id="${p}-w">${esc(s.term?.word ?? s.title ?? '')}</div>
      ${pos}
      <div class="rule center" id="${p}-rule"></div>
      <div class="term-def" id="${p}-def">${esc(s.term?.definition ?? s.desc ?? '')}</div>`;
  },
  anim(s, { m, at, p }) {
    const a = [
      m.reveal(q(p, 'w'), at(0.3), { scale: 0.7, d: 0.65, ease: EASE.pop }),
    ];
    if (s.eyebrow) a.push(m.reveal(q(p, 'pos'), at(0.7), { y: 12, d: 0.4, ease: EASE.soft }));
    a.push(m.sweep(q(p, 'rule'), at(0.9)));
    a.push(m.reveal(q(p, 'def'), at(1.1), { y: 20, d: 0.6, ease: EASE.soft }));
    a.push(m.glow(q(p, 'w'), at(2.0), { blur: 34 }));
    return a;
  },
};

export const compare: SceneModule = {
  type: 'compare',
  css: (vertical) => `
      .compare-grid{display:flex;${vertical ? 'flex-direction:column;' : ''}align-items:stretch;gap:${vertical ? 18 : 28}px;width:100%;max-width:${vertical ? 920 : 1500}px;margin-top:${vertical ? 30 : 26}px}
      .compare-col{flex:1;background:var(--bg2);border:1px solid var(--bg3);border-radius:20px;padding:${vertical ? 28 : 38}px}
      .compare-col.pos{border-color:var(--accent)}
      .compare-h{font-family:Sora,system-ui;font-weight:700;font-size:${px(vertical, 36, 34)}px;letter-spacing:-1px;margin-bottom:18px}
      .compare-col.neg .compare-h{color:var(--muted)}
      .compare-col.pos .compare-h{color:var(--accent)}
      .compare-list{list-style:none;display:flex;flex-direction:column;gap:12px}
      .compare-list li{font-family:Inter,system-ui;font-size:${px(vertical, 28, 26)}px;color:var(--fg);display:flex;gap:12px;align-items:flex-start;line-height:1.35}
      .compare-list li::before{font-family:'JetBrains Mono',monospace;font-weight:700}
      .neg .compare-list li::before{content:"\\2715";color:var(--muted)}
      .pos .compare-list li::before{content:"\\2713";color:var(--accent)}
      .vs{display:flex;align-items:center;justify-content:center;font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 34, 40)}px;color:var(--muted);${vertical ? '' : 'flex:none;width:60px;'}}`,
  html(s, { p }) {
    const col = (side: 'neg' | 'pos', data: { title: string; items: string[] } | undefined, key: string) => {
      const items = (data?.items ?? []).map((it) => `<li>${esc(it)}</li>`).join('');
      return `<div class="compare-col ${side}" id="${p}-${key}"><div class="compare-h">${esc(data?.title ?? '')}</div><ul class="compare-list">${items}</ul></div>`;
    };
    return `${col('neg', s.compare?.left, 'L')}
      <div class="vs" id="${p}-vs">VS</div>
      ${col('pos', s.compare?.right, 'R')}`;
  },
  anim(s, { m, at, p }) {
    void s;
    return [
      m.reveal(q(p, 'L'), at(0.5), { x: -40, d: 0.6, ease: EASE.out }),
      m.reveal(q(p, 'vs'), at(0.9), { scale: 0.4, d: 0.5, ease: EASE.pop }),
      m.reveal(q(p, 'R'), at(0.7), { x: 40, d: 0.6, ease: EASE.out }),
      m.pulse(q(p, 'vs'), at(2.6), { times: 2 }),
    ];
  },
};

export const proof: SceneModule = {
  type: 'proof',
  css: (vertical) => `
      .proof-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:${vertical ? 22 : 40}px;width:100%;max-width:${vertical ? 940 : 1500}px;margin-top:${vertical ? 34 : 30}px}
      .proof-item{flex:${vertical ? '1 1 40%' : '1'};min-width:${vertical ? 260 : 240}px;background:var(--bg2);border:1px solid var(--bg3);border-radius:20px;padding:${vertical ? 30 : 38}px;text-align:center}
      .proof-stat{font-family:Sora,system-ui;font-weight:800;font-size:${px(vertical, 72, 80)}px;color:var(--accent);line-height:1;letter-spacing:-3px}
      .proof-label{font-family:Inter,system-ui;font-size:${px(vertical, 28, 26)}px;color:var(--muted);margin-top:12px;line-height:1.35}`,
  html(s, { p }) {
    const items = (s.proof ?? []).map((it, i) =>
      `<div class="proof-item" id="${p}-pf${i}"><div class="proof-stat">${esc(it.stat)}</div><div class="proof-label">${esc(it.label)}</div></div>`).join('\n        ');
    const head = s.title ? `<h2 class="h2 center" id="${p}-h">${esc(s.title)}</h2>` : '';
    return `${head}
      <div class="proof-grid">
        ${items}
      </div>`;
  },
  anim(s, { m, at, p }) {
    const a: string[] = [];
    if (s.title) a.push(m.reveal(q(p, 'h'), at(0.3), { y: 24, d: 0.5, ease: EASE.soft }));
    const sels = (s.proof ?? []).map((_, i) => q(p, `pf${i}`));
    if (sels.length) {
      a.push(m.reveal(sels, at(0.8), { y: 30, scale: 0.9, d: 0.55, stagger: 0.16, ease: EASE.pop }));
      a.push(m.pulse(`${q(p, 'pf0')} .proof-stat`, at(2.6), { times: 2 }));
    }
    return a;
  },
};
