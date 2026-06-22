// Composer: spec resolvido (cenas + marca + formato) → index.html final (string).
// Substitui o antigo generator.ts. Sem intermediário .mjs: testável e sem escape duplo.

import { layoutTimeline, round, DEFAULT_TIMING } from './engine/timing.js';
import type { Timing, Timeline } from './engine/timing.js';
import { createMotion, TRANS, transOf } from './engine/motion.js';
import { getScene, collectSceneCss } from './scenes/index.js';
import type { SceneCtx } from './scenes/index.js';
import { hexToRgb } from './scenes/util.js';
import type { SceneSpec, SceneType } from './specs/types.js';
import type { Brand } from './brands/types.js';

export interface ComposeInput {
  scenes: SceneSpec[];                 // com audio_dur preenchido
  brand: Brand;
  vertical: boolean;
  fontCss?: string;                    // conteúdo de assets/fonts/fonts.css (inline)
  music?: { src: string; vol: number } | null;
  gsapSrc?: string;                    // default: 'assets/gsap.min.js'
  ghost?: string;                      // texto decorativo gigante de fundo
  timing?: Timing;
}

export interface ComposeResult {
  html: string;
  total: number;
  timeline: Timeline;
}

const usesBg = (s: SceneSpec): boolean => !!s.image && s.type !== 'img' && s.type !== 'imgrow';

export function compose(input: ComposeInput): ComposeResult {
  const { scenes, brand, vertical } = input;
  const timing = input.timing ?? DEFAULT_TIMING;
  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;
  const FADE = timing.FADE;
  const gsapSrc = input.gsapSrc ?? 'assets/gsap.min.js';

  const tl = layoutTimeline(scenes.map((s) => s.audio_dur ?? 5), timing);
  const { scenes: S, total: TOTAL } = tl;
  const m = createMotion(vertical);

  // ── HTML + animação por cena ───────────────────────────────────────────────
  const sectionsHTML: string[] = [];
  const captionsHTML: string[] = [];
  const audioHTML: string[] = [];
  const animLines: string[] = [];

  scenes.forEach((spec, idx) => {
    const st = S[idx];
    const i = st.i;
    const p = `s${i}`;
    const mod = getScene(spec.type);
    const ctx: SceneCtx = {
      i, p, m, vertical, brand,
      start: st.start, end: st.end, dur: st.dur,
      at: (d: number) => round(st.start + d),
    };
    const inner = mod.html(spec, ctx);
    const bg = usesBg(spec)
      ? `<img class="scene-bg-img" id="${p}-bg" src="${spec.image}" alt="" data-layout-ignore><div class="scene-overlay" data-layout-ignore></div>`
      : '';
    const cls = usesBg(spec) ? ' has-img' : '';
    sectionsHTML.push(
      `    <section id="${p}" class="scene clip" data-start="${st.start}" data-duration="${st.dur}" data-track-index="${i % 2 === 1 ? 1 : 3}">
      ${bg}<div class="scene-inner${cls}" id="scene-inner-${i}" data-layout-allow-overflow>${inner}</div>
    </section>`,
    );
    captionsHTML.push(
      `    <div class="caption clip" id="cap-${i}" data-start="${st.start}" data-duration="${st.dur}" data-track-index="${i % 2 === 1 ? 2 : 4}">${spec.caption}</div>`,
    );
    audioHTML.push(
      `    <audio id="a${i}" data-start="${st.audioStart}" data-duration="${st.audioDur}" data-track-index="20" src="assets/audio/s${i}.wav"></audio>`,
    );
    animLines.push(emitFrame(spec, idx, scenes, S, FADE, mod.anim(spec, ctx)));
  });

  const musicHTML = input.music
    ? `    <audio id="bgm" data-start="0" data-duration="${TOTAL}" data-track-index="21" data-volume="${input.music.vol}" src="${input.music.src}"></audio>`
    : '';

  // ── CSS ────────────────────────────────────────────────────────────────────
  const usedTypes = scenes.map((s) => s.type) as SceneType[];
  const css = baseCss(brand, vertical, W, H) + '\n' + collectSceneCss(usedTypes, vertical);

  const ghost = (input.ghost ?? brand.name.split(' ')[0] ?? '').toUpperCase();

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=${W},height=${H}"/>
    <script src="${gsapSrc}"></script>
    <style>
${input.fontCss ?? ''}
${css}
    </style>
  </head>
  <body class="${vertical ? 'v' : ''}${brand.light ? ' light' : ''}">
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}"
         style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:var(--bg)">
      <div class="bg-layer" data-layout-ignore>
        <div id="glow"></div><div id="glow2"></div><div id="grid"></div>
        <div class="ghost" id="ghost" data-layout-ignore>${ghost}</div><div id="grain"></div>
      </div>
${sectionsHTML.join('\n')}
${captionsHTML.join('\n')}
      <div id="progress"></div>
      <div id="tdip" data-layout-ignore></div>
${audioHTML.join('\n')}
${musicHTML}
      <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });
        const TOTAL = ${TOTAL};
        tl.to("#glow",{scale:1.22,opacity:.55,duration:4.5,yoyo:true,repeat:Math.ceil(TOTAL/4.5)+1,ease:"sine.inOut"},0);
        tl.to("#glow2",{scale:1.18,duration:6,yoyo:true,repeat:Math.ceil(TOTAL/6)+1,ease:"sine.inOut"},0);
        tl.to("#ghost",{x:120,duration:TOTAL,ease:"none"},0);
        tl.to("#grid",{backgroundPositionX:"+=128",backgroundPositionY:"+=128",duration:18,repeat:Math.ceil(TOTAL/18)+1,ease:"none"},0);
        tl.fromTo("#progress",{scaleX:0},{scaleX:1,duration:TOTAL,ease:"none"},0);
${animLines.join('\n')}
        tl.to("#root", { opacity: 1, duration: 0.001 }, ${round(TOTAL - 0.001)});
        window.__timelines["main"] = tl;
      </script>
    </div>
  </body>
</html>
`;

  return { html, total: TOTAL, timeline: tl };
}

// ─── frame de uma cena: Ken Burns + transição entrada/saída + legenda + anim ──

function emitFrame(
  spec: SceneSpec,
  idx: number,
  all: SceneSpec[],
  S: ReturnType<typeof layoutTimeline>['scenes'],
  FADE: number,
  sceneAnim: string[],
): string {
  const st = S[idx];
  const i = st.i;
  const clip = `#s${i}`;
  const inner = `#scene-inner-${i}`;
  const bgEl = `#s${i}-bg`;
  const inType = transOf(spec.transIn);
  const next = all[idx + 1];
  const outType = transOf(next?.transIn);
  const L: string[] = [];
  if (usesBg(spec)) {
    L.push(`tl.fromTo(${j(bgEl)},{scale:1,yPercent:0},{scale:1.08,yPercent:-2,duration:${st.dur},ease:"sine.inOut"},${st.start});`);
  } else {
    L.push(`tl.fromTo(${j(inner)},{scale:1,yPercent:0},{scale:1.05,yPercent:-1.6,duration:${st.dur},ease:"sine.inOut"},${st.start});`);
  }
  for (const line of TRANS[inType].in(clip, inner, st.start, FADE)) L.push(line);
  for (const line of TRANS[outType].out(clip, inner, round(st.end - FADE), FADE)) L.push(line);
  L.push(`tl.set(${j(inner)},{opacity:0},${round(st.end)});`);
  for (const line of sceneAnim) L.push(line);
  L.push(`tl.fromTo("#cap-${i}",{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:"power2.out"},${round(st.start + 0.35)});`);
  L.push(`tl.to("#cap-${i}",{opacity:0,duration:.4,ease:"power2.in"},${round(st.end - 0.5)});`);
  return '        ' + L.join('\n        ');
}

const j = (s: string) => JSON.stringify(s);

// ─── CSS base (palette + tipografia + layout + decoração) ─────────────────────

function baseCss(brand: Brand, vertical: boolean, W: number, H: number): string {
  const p = brand.palette;
  const vars = Object.entries(p).map(([k, v]) => `--${k}:${v}`).join(';');
  const rgb = `--bg-rgb:${hexToRgb(p.bg)};--accent-rgb:${hexToRgb(p.accent)};--fg-rgb:${hexToRgb(p.fg)};--code-rgb:${hexToRgb(p.code)}`;
  const fz = (v: number, h: number) => (vertical ? v : h);
  return `      :root{${vars};${rgb}}
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
      .accent{color:var(--accent)}.dim{color:var(--muted)}
      /* decoração de fundo */
      .bg-layer{position:absolute;inset:0;z-index:0;pointer-events:none}
      #glow{position:absolute;top:-260px;left:-180px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(circle,rgba(var(--accent-rgb),.18),rgba(var(--accent-rgb),0) 62%);filter:blur(8px)}
      #glow2{position:absolute;bottom:-360px;right:-240px;width:1200px;height:1200px;border-radius:50%;background:radial-gradient(circle,rgba(var(--code-rgb),.10),rgba(var(--code-rgb),0) 62%)}
      #grid{position:absolute;inset:-2px;opacity:.5;background-image:linear-gradient(rgba(var(--fg-rgb),.05) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--fg-rgb),.05) 1px,transparent 1px);background-size:64px 64px}
      .ghost{position:absolute;font-family:Sora,sans-serif;font-weight:800;color:rgba(var(--accent-rgb),.04);font-size:${vertical ? 380 : 520}px;line-height:.8;letter-spacing:-.03em;top:${vertical ? 520 : 240}px;left:-40px;white-space:nowrap;user-select:none}
      #grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
      #progress{position:absolute;left:0;bottom:0;height:6px;width:100%;transform:scaleX(0);transform-origin:left center;background:linear-gradient(90deg,var(--accent),var(--accent2));z-index:40;box-shadow:0 0 18px rgba(var(--accent-rgb),.5)}
      #tdip{position:absolute;inset:0;background:#000;opacity:0;z-index:99;pointer-events:none}
      /* cena (contrato HyperFrames) */
      .scene{position:absolute;inset:0;z-index:10;overflow:hidden}
      .scene-inner{position:absolute;inset:-5%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${vertical ? '170px 70px 240px' : '120px 150px'};gap:0;will-change:transform,opacity;z-index:2}
      .scene-inner::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 40%,rgba(var(--accent-rgb),.07) 0%,transparent 65%);pointer-events:none}
      .scene-bg-img{position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;z-index:0;will-change:transform}
      .scene-overlay{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(var(--bg-rgb),.58) 0%,rgba(var(--bg-rgb),.38) 45%,rgba(var(--bg-rgb),.70) 100%)}
      .has-img::before{display:none}
      /* tipografia compartilhada */
      .title{font-family:Sora,system-ui;font-weight:800;font-size:${fz(96, 72)}px;line-height:1.06;text-align:center;color:var(--fg);letter-spacing:-2px;margin-top:18px}
      .h2{font-family:Sora,system-ui;font-weight:800;font-size:${fz(74, 56)}px;line-height:1.1;text-align:center;color:var(--fg);letter-spacing:-2px;margin-top:14px}
      .h2.left{text-align:left;align-self:flex-start}
      .h2.center{text-align:center}
      .eyebrow{display:flex;align-items:center;gap:10px;font-family:Inter,system-ui;font-size:${fz(28, 22)}px;font-weight:600;color:var(--accent);letter-spacing:3px;text-transform:uppercase}
      .dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent)}
      .kicker{font-family:'JetBrains Mono',monospace;font-size:${fz(22, 22)}px;letter-spacing:.26em;color:var(--accent);text-transform:uppercase;font-weight:600;margin-bottom:16px}
      .rule{height:4px;width:${vertical ? 130 : 160}px;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:6px;margin:20px 0}
      .rule.center{margin:18px auto}
      .subhead{font-family:Inter,system-ui;font-size:${fz(34, 26)}px;font-weight:400;color:var(--muted);text-align:center;margin-top:4px}
      .desc{font-family:Inter,system-ui;font-size:${fz(34, 26)}px;font-weight:400;color:var(--muted);text-align:center;line-height:1.5;margin-top:10px}
      .cursor{display:inline-block;width:3px;height:${fz(36, 30)}px;background:var(--accent);margin-left:4px;vertical-align:middle}
      .num-badge{font-family:Sora,system-ui;font-size:${fz(110, 88)}px;font-weight:800;color:var(--accent);line-height:1;letter-spacing:-4px;margin-bottom:6px}
      .num-badge.teal{color:var(--code)}
      .reg{position:absolute;width:28px;height:28px;border:2px solid rgba(var(--accent-rgb),.35)}
      .reg.tl{top:48px;left:48px;border-right:none;border-bottom:none}
      .reg.br{bottom:48px;right:48px;border-left:none;border-top:none}
      /* legenda */
      .caption{position:absolute;bottom:${vertical ? 150 : 64}px;left:50%;transform:translateX(-50%);z-index:30;max-width:${vertical ? 940 : 1500}px;text-align:center;font-family:Inter,system-ui;font-size:${fz(33, 30)}px;font-weight:500;color:var(--fg);background:rgba(var(--bg-rgb),.78);border:1px solid var(--bg3);border-radius:14px;padding:14px 36px;backdrop-filter:blur(6px)}`;
}
