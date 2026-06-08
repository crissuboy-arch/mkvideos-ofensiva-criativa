// Gera build-index.mjs completo a partir de dados de cenas — sem IA, sem rede.
// Entrada: título, tema, cenas com durações reais de WAV.
// Saída: string JavaScript pronta para ser gravada como build-index.mjs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

export interface BrandConfig {
  name: string;
  tagline: string;
  slogan: string;
  instagram: string;
  site: string;
}

export interface PaletteConfig {
  bg: string; bg2: string; bg3: string;
  fg: string; muted: string;
  accent: string; accent2: string; code: string;
}

export interface SceneData {
  titulo: string;    // exibido visualmente na cena
  desc: string;      // linha de suporte (pode ser vazio)
  audio_dur: number; // duração real do WAV (ffprobe)
  caption: string;   // legenda de rodapé
}

export interface GeneratorParams {
  titulo: string;         // título completo do vídeo
  tema: string;           // eyebrow / tema (ex: "Inteligência Artificial")
  scenes: SceneData[];    // cenas de conteúdo (sem hook e sem CTA)
  cta_audio_dur: number;
  hook_audio_dur: number;
  vertical: boolean;
  brand: BrandConfig;
  palette: PaletteConfig;
}

// ─── helpers de escape ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Produz código JS de um template-literal que será embutido no build-index.mjs
// (converte ${expr} em \${expr} para que sobreviva dentro de outro template)
function jsFn(body: string): string {
  return '(p) => `' + body + '`';
}

// ─── HTML de cada layout ──────────────────────────────────────────────────────

function hookHTML(titulo: string, tema: string): string {
  return jsFn(`
      <div class="eyebrow" id="\${p}-ey"><span class="dot"></span>${esc(tema)}</div>
      <h1 class="hero-title" id="\${p}-h">${esc(titulo)}</h1>
      <div class="rule" id="\${p}-rule"></div>
      <p class="subhead" id="\${p}-sub">Salva esse vídeo<span class="cursor" id="\${p}-cur"></span></p>`);
}

function numberedHTML(titulo: string, desc: string, idx: number, useAccent2: boolean): string {
  const num = String(idx + 1).padStart(2, '0');
  const cls = useAccent2 ? ' teal' : '';
  return jsFn(`
      <div class="num-badge${cls}" id="\${p}-num">${num}</div>
      <h2 class="h2" id="\${p}-h">${esc(titulo)}</h2>
      <div class="rule" id="\${p}-rule"></div>
      <p class="desc" id="\${p}-d">${esc(desc)}</p>`);
}

function ctaHTML(b: BrandConfig): string {
  const [word1, ...rest] = b.name.split(' ');
  const word2 = rest.join(' ');
  return jsFn(`
    <div class="oc-eyebrow" id="\${p}-eye">${esc(b.tagline.toUpperCase())}</div>
    <div class="oc-brand" id="\${p}-brand">
      <span class="oc-b1">${esc(word1)}</span><br>
      <span class="oc-b2">${esc(word2)}</span>
    </div>
    <div class="rule center" id="\${p}-rule"></div>
    <p class="oc-slogan" id="\${p}-sl">${esc(b.slogan)}</p>
    <div class="oc-handle" id="\${p}-hdl">${esc(b.instagram)}</div>
    <div class="oc-site mono" id="\${p}-url">${esc(b.site)}</div>
    <div class="reg tl" id="\${p}-r1"></div><div class="reg br" id="\${p}-r2"></div>`);
}

// ─── animações por tipo ───────────────────────────────────────────────────────

const hookAnim = `(at, p) => [
      M.reveal(\`#\${p}-ey\`,  at(0.15), { y: -24, d: .5 }),
      M.reveal(\`#\${p}-h\`,   at(0.4),  { y: 60, d: .75, ease: "power4.out" }),
      M.sweep( \`#\${p}-rule\`,at(1.0)),
      M.reveal(\`#\${p}-sub\`, at(1.2),  { y: 20, d: .55, ease: EASE.soft }),
      M.blink( \`#\${p}-cur\`, at(1.6),  { times: 14 }),
      M.glow(  \`#\${p}-h\`,   at(2.2),  { blur: 30 }),
    ]`;

function numberedAnim(useFloat: boolean): string {
  const mid = useFloat
    ? `M.float( \`#\${p}-h\`,   at(2.0), { dist: 8 }),`
    : `M.pulse( \`#\${p}-num\`, at(2.5), { times: 3 }),`;
  return `(at, p) => [
      M.reveal(\`#\${p}-num\`, at(0.2), { scale: .6, d: .55, ease: EASE.pop }),
      M.reveal(\`#\${p}-h\`,   at(0.5), { y: 40, d: .65 }),
      M.sweep( \`#\${p}-rule\`,at(1.0)),
      M.reveal(\`#\${p}-d\`,   at(1.1), { y: 18, d: .5, ease: EASE.soft }),
      ${mid}
    ]`;
}

const ctaAnim = `(at, p) => [
      M.reveal(\`#\${p}-eye\`,   at(0.2), { y: -18, d: .5, ease: EASE.soft }),
      M.reveal(\`#\${p}-brand\`, at(0.5), { scale: .7, d: .7, ease: "back.out(1.7)" }),
      M.sweep( \`#\${p}-rule\`,  at(1.1), { d: .6 }),
      M.reveal(\`#\${p}-sl\`,    at(1.3), { y: 20, d: .55, ease: EASE.soft }),
      M.reveal(\`#\${p}-hdl\`,   at(1.6), { y: 16, d: .5, ease: EASE.soft }),
      M.reveal(\`#\${p}-url\`,   at(1.8), { y: 12, d: .45 }),
      M.glow(  \`#\${p}-brand\`, at(1.4)),
      M.reveal([\`#\${p}-r1\`, \`#\${p}-r2\`], at(0.6), { scale: .5, d: .6, stagger: .12, ease: "back.out(2)" }),
    ]`;

// ─── função principal ─────────────────────────────────────────────────────────

export function generateBuildIndex(p: GeneratorParams): string {
  const { titulo, tema, scenes, cta_audio_dur, hook_audio_dur, vertical, brand, palette } = p;
  const n = scenes.length;

  // Determina transições especiais (máx 2-3 momentos-chave)
  const midIdx = Math.floor(n / 2);  // cena do meio ganha push
  // ALL = [hook, ...content, cta] — índices 0..n+1
  const transInForScene = (allIdx: number): string => {
    if (allIdx === 1) return 'zoom';                      // hook → primeira cena
    if (allIdx === midIdx + 1 && n >= 3) return 'push';  // meio do conteúdo
    if (allIdx === n + 1) return 'fadeBlack';             // última → CTA
    return 'undefined';
  };

  // ── monta blocos de cenas ──────────────────────────────────────────────────
  const allSceneBlocks: string[] = [];

  // Hook (index 0 em ALL)
  allSceneBlocks.push(`  {
    audio: ${hook_audio_dur},
    caption: ${JSON.stringify(titulo)},
    html: ${hookHTML(titulo, tema)},
    anim: ${hookAnim},
  }`);

  // Cenas numeradas (índices 1..n em ALL)
  scenes.forEach((sc, i) => {
    const transIn = transInForScene(i + 1);
    const transLine = transIn !== 'undefined' ? `\n    transIn: "${transIn}",` : '';
    allSceneBlocks.push(`  {
    audio: ${sc.audio_dur},
    caption: ${JSON.stringify(sc.caption)},${transLine}
    html: ${numberedHTML(sc.titulo, sc.desc, i, i % 2 === 1)},
    anim: ${numberedAnim(i % 2 === 0)},
  }`);
  });

  // CTA (índice n+1 em ALL)
  allSceneBlocks.push(`  {
    audio: ${cta_audio_dur},
    caption: ${JSON.stringify(brand.instagram)},
    transIn: "fadeBlack",
    html: ${ctaHTML(brand)},
    anim: ${ctaAnim},
  }`);

  const W = vertical ? 1080 : 1920;
  const H = vertical ? 1920 : 1080;

  // ── CSS da paleta ──────────────────────────────────────────────────────────
  const paletteCSS = Object.entries(palette)
    .map(([k, v]) => `--${k}:${v}`)
    .join(';');

  return `// AUTO-GERADO por mkivideos gerar — editável via scenes.json
import { writeFileSync, readFileSync } from "node:fs";

const VERT = process.argv.includes("--vertical");
const W = ${W}, H = ${H};
const OUT = "index.html";
const LEAD = 0.3, TAIL = 0.5, FADE = 0.35;
const MUSIC = "assets/audio/music-bg.wav", MUSIC_VOL = 0.10;

const FONT_CSS = readFileSync("assets/fonts/fonts.css", "utf8")
  .replace(/\\.\\/fonts\\//g, "assets/fonts/");

// === TODAS AS CENAS (hook + conteúdo + CTA) ===
const ALL = [
${allSceneBlocks.join(',\n')}
];

// CTA é o último — contrato obrigatório
const SCENES = ALL.slice(0, -1);
const CTA    = ALL[ALL.length - 1];
const ALL_FINAL = [...SCENES, CTA];

// === TIMING ===
const round = (n) => Math.round(n * 1000) / 1000;
let t = 0;
const S = ALL_FINAL.map((sc, i) => {
  const dur = LEAD + sc.audio + TAIL;
  const o = { i: i+1, start: round(t), dur: round(dur),
              audioStart: round(t+LEAD), audioDur: round(sc.audio), end: round(t+dur) };
  t += dur; return o;
});
const TOTAL = round(t);

// === VOCABULÁRIO DE MOVIMENTO ===
const J = (s) => JSON.stringify(s);
const VMOVE = ${vertical ? 0.7 : 1};
const mv = (v) => Math.round(v * VMOVE);
const EASE = { out:"power3.out", soft:"power2.out", in:"power2.in",
               back:"back.out(1.6)", expo:"expo.out", pop:"back.out(1.8)" };
const M = {
  reveal(sel,at,o={}){const f=["opacity:0"];if(o.x)f.push(\`x:\${mv(o.x)}\`);if(o.y)f.push(\`y:\${mv(o.y)}\`);if(o.scale!=null)f.push(\`scale:\${o.scale}\`);const ex=o.stagger?\`,stagger:\${o.stagger}\`:"";return \`tl.from(\${J(sel)},{\${f.join(",")},duration:\${o.d??0.55},ease:"\${o.ease??EASE.out}"\${ex}},\${at});\`;},
  sweep(sel,at,o={}){return \`tl.fromTo(\${J(sel)},{scaleX:0},{scaleX:1,duration:\${o.d??0.7},ease:"\${o.ease??EASE.expo}",transformOrigin:"left center"},\${at});\`;},
  blink(sel,at,o={}){return \`tl.fromTo(\${J(sel)},{opacity:1},{opacity:0,duration:\${o.d??0.5},repeat:\${o.times??10},yoyo:true,ease:"none"},\${at});\`;},
  float(sel,at,o={}){return \`tl.to(\${J(sel)},{y:"-=\${mv(o.dist??10)}",duration:\${o.d??1.6},repeat:\${o.repeat??4},yoyo:true,ease:"sine.inOut"},\${at});\`;},
  pulse(sel,at,o={}){return \`tl.fromTo(\${J(sel)},{scale:1},{scale:\${o.s??1.08},duration:\${o.d??0.35},repeat:\${(o.times??3)*2-1},yoyo:true,ease:"sine.inOut"},\${at});\`;},
  glow(sel,at,o={}){const c=o.color??"201,162,39";return \`tl.fromTo(\${J(sel)},{filter:"drop-shadow(0 0 0px rgba(\${c},0))"},{filter:"drop-shadow(0 0 \${o.blur??26}px rgba(\${c},.55))",duration:\${o.d??1.1},repeat:\${o.times??4},yoyo:true,ease:"sine.inOut"},\${at});\`;},
  raw(s){return s;},
};

// === TRANSIÇÕES ===
const TRANS = {
  fade:{
    in: (c,n,at,d)=>[\`tl.fromTo(\${J(n)},{opacity:0},{opacity:1,duration:\${d},ease:"power2.out"},\${at});\`],
    out:(c,n,at,d)=>[\`tl.to(\${J(n)},{opacity:0,duration:\${d},ease:"power2.in"},\${at});\`],
  },
  push:{
    in: (c,n,at,d)=>[\`tl.set(\${J(n)},{opacity:1},\${at});\`,\`tl.fromTo(\${J(c)},{xPercent:110},{xPercent:0,duration:\${d},ease:"power3.out"},\${at});\`],
    out:(c,n,at,d)=>[\`tl.to(\${J(c)},{xPercent:-110,duration:\${d},ease:"power3.in"},\${at});\`],
  },
  zoom:{
    in: (c,n,at,d)=>[\`tl.fromTo(\${J(n)},{opacity:0},{opacity:1,duration:\${d},ease:"power2.out"},\${at});\`,\`tl.fromTo(\${J(c)},{scale:0.7},{scale:1,duration:\${d},ease:"power3.out"},\${at});\`],
    out:(c,n,at,d)=>[\`tl.to(\${J(n)},{opacity:0,duration:\${d},ease:"power2.in"},\${at});\`,\`tl.to(\${J(c)},{scale:1.35,duration:\${d},ease:"power3.in"},\${at});\`],
  },
  fadeBlack:{
    in: (c,n,at,d)=>[\`tl.fromTo(\${J(n)},{opacity:0},{opacity:1,duration:\${round(d*.6)},ease:"power2.out"},\${round(at+d*.4)});\`,\`tl.fromTo("#tdip",{opacity:1},{opacity:0,duration:\${d},ease:"power2.out",overwrite:"auto"},\${at});\`],
    out:(c,n,at,d)=>[\`tl.to(\${J(n)},{opacity:0,duration:\${round(d*.6)},ease:"power2.in"},\${at});\`,\`tl.fromTo("#tdip",{opacity:0},{opacity:1,duration:\${d},ease:"power2.in",overwrite:"auto"},\${at});\`],
  },
};

// === RENDER DE CENA ===
function emitScene(sc,idx){
  const s=S[idx],i=s.i,p=\`s\${i}\`;
  const at=(d)=>round(s.start+d);
  const dur=round(s.end-s.start);
  const clip=\`#s\${i}\`,inner=\`#scene-inner-\${i}\`;
  const inType=TRANS[sc.transIn]?sc.transIn:"fade";
  const next=ALL_FINAL[idx+1];
  const outType=next&&TRANS[next.transIn]?next.transIn:"fade";
  const L=[];
  L.push(\`tl.fromTo(\${J(inner)},{scale:1,yPercent:0},{scale:1.05,yPercent:-1.6,duration:\${dur},ease:"sine.inOut"},\${s.start});\`);
  for(const line of TRANS[inType].in(clip,inner,s.start,FADE)) L.push(line);
  for(const line of TRANS[outType].out(clip,inner,round(s.end-FADE),FADE)) L.push(line);
  L.push(\`tl.set(\${J(inner)},{opacity:0},\${round(s.end)});\`);
  for(const line of sc.anim(at,p)) L.push(line);
  L.push(\`tl.fromTo("#cap-\${i}",{opacity:0,y:14},{opacity:1,y:0,duration:.5,ease:"power2.out"},\${at(0.35)});\`);
  L.push(\`tl.to("#cap-\${i}",{opacity:0,duration:.4,ease:"power2.in"},\${round(s.end-0.5)});\`);
  return L.join("\\n      ");
}

// === MONTAGEM ===
const scenesHTML=S.map((s,idx)=>\`
    <section id="s\${s.i}" class="scene clip" data-start="\${s.start}" data-duration="\${s.dur}" data-track-index="\${s.i%2===1?1:3}">
      <div class="scene-inner" id="scene-inner-\${s.i}" data-layout-allow-overflow>\${ALL_FINAL[idx].html(\`s\${s.i}\`)}</div>
    </section>\`).join("");
const captionsHTML=S.map((s,idx)=>\`
    <div class="caption clip" id="cap-\${s.i}" data-start="\${s.start}" data-duration="\${s.dur}" data-track-index="\${s.i%2===1?2:4}">\${ALL_FINAL[idx].caption}</div>\`).join("");
const audioHTML=S.map((s)=>\`
    <audio id="a\${s.i}" data-start="\${s.audioStart}" data-duration="\${s.audioDur}" data-track-index="20" src="assets/audio/s\${s.i}.wav"></audio>\`).join("");
const musicHTML=\`
    <audio id="bgm" data-start="0" data-duration="\${TOTAL}" data-track-index="21" data-volume="\${MUSIC_VOL}" src="\${MUSIC}"></audio>\`;
const animJS=S.map((s,idx)=>emitScene(ALL_FINAL[idx],idx)).join("\\n      ");

const html=\`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=\${W},height=\${H}"/>
    <script src="assets/gsap.min.js"></script>
    <style>
      \${FONT_CSS}
      :root{${paletteCSS}}
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:\${W}px;height:\${H}px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .scene{position:absolute;inset:0;overflow:hidden}
      .scene-inner{position:absolute;inset:-5%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px 60px;gap:0;will-change:transform,opacity}
      .scene-inner::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 40%,rgba(201,162,39,.07) 0%,transparent 65%);pointer-events:none}
      .hero-title{font-family:Sora,system-ui;font-size:${vertical ? 96 : 72}px;font-weight:800;line-height:1.08;text-align:center;color:var(--fg);letter-spacing:-2px;margin-top:20px}
      .h2{font-family:Sora,system-ui;font-size:${vertical ? 74 : 56}px;font-weight:800;line-height:1.1;text-align:center;color:var(--fg);letter-spacing:-2px;margin-top:16px}
      .eyebrow{display:flex;align-items:center;gap:10px;font-family:Inter,system-ui;font-size:${vertical ? 28 : 22}px;font-weight:600;color:var(--accent);letter-spacing:3px;text-transform:uppercase}
      .dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
      .rule{height:3px;width:110px;background:var(--accent);margin:22px auto}
      .rule.center{margin:18px auto}
      .subhead{font-family:Inter,system-ui;font-size:${vertical ? 34 : 26}px;font-weight:400;color:var(--muted);text-align:center;margin-top:4px}
      .cursor{display:inline-block;width:3px;height:36px;background:var(--accent);margin-left:4px;vertical-align:middle}
      .num-badge{font-family:Sora,system-ui;font-size:${vertical ? 110 : 88}px;font-weight:800;color:var(--accent);line-height:1;letter-spacing:-4px;margin-bottom:6px}
      .num-badge.teal{color:var(--code)}
      .desc{font-size:${vertical ? 34 : 26}px;font-weight:400;color:var(--muted);text-align:center;line-height:1.5;margin-top:10px}
      .oc-eyebrow{font-family:Inter,system-ui;font-size:${vertical ? 28 : 22}px;font-weight:600;color:var(--muted);letter-spacing:5px;text-align:center}
      .oc-brand{font-family:Sora,system-ui;font-size:${vertical ? 100 : 80}px;font-weight:800;line-height:1.05;text-align:center;letter-spacing:-2px;margin:10px 0}
      .oc-b1{color:var(--fg)}.oc-b2{color:var(--accent)}
      .oc-slogan{font-size:${vertical ? 34 : 26}px;color:var(--muted);text-align:center;line-height:1.5;margin-top:8px}
      .oc-handle{font-size:${vertical ? 36 : 28}px;font-weight:600;color:var(--accent);text-align:center;margin-top:16px}
      .oc-site{font-size:${vertical ? 28 : 22}px;color:var(--muted);text-align:center;margin-top:8px}
      .mono{font-family:'JetBrains Mono',monospace}
      .reg{position:absolute;width:28px;height:28px;border:2px solid rgba(201,162,39,.35)}
      .reg.tl{top:48px;left:48px;border-right:none;border-bottom:none}
      .reg.br{bottom:48px;right:48px;border-left:none;border-top:none}
      .caption{position:absolute;bottom:70px;left:0;right:0;padding:12px 44px;background:rgba(10,15,30,.82);backdrop-filter:blur(8px);font-size:${vertical ? 32 : 24}px;font-weight:500;color:var(--fg);text-align:center;line-height:1.4;border-top:1px solid rgba(201,162,39,.15)}
      #tdip{position:absolute;inset:0;background:#000;pointer-events:none;opacity:0;z-index:99}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="\${TOTAL}" data-width="\${W}" data-height="\${H}"
         style="position:relative;width:\${W}px;height:\${H}px;overflow:hidden;background:var(--bg)">
      <div id="tdip" data-layout-ignore></div>
      \${scenesHTML}
      \${captionsHTML}
      \${audioHTML}
      \${musicHTML}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      \${animJS}
      tl.to("#root", { opacity: 1, duration: 0.001 }, \${TOTAL - 0.001});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>\`;

writeFileSync(OUT, html, "utf-8");
console.log(\`\${OUT} gerado — \${W}x\${H}, \${TOTAL}s, \${S.length} cenas\`);
`;
}

// ─── lê template JSON (brand + palette) ──────────────────────────────────────

export interface VideoTemplate {
  version: string;
  brand: BrandConfig;
  palette: PaletteConfig;
  tts: { hook: string; numbered: string; cta: string };
  transitions: { hook_to_first: string; mid_special: string; last_to_cta: string };
}

export function loadTemplate(name = 'video-explicativo'): VideoTemplate {
  const f = path.resolve(__dir, '..', 'templates', `${name}.json`);
  return JSON.parse(readFileSync(f, 'utf-8')) as VideoTemplate;
}

// ─── texto TTS por cena ───────────────────────────────────────────────────────

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Gera os textos de narração TTS para cada cena (sem IA). */
export function buildTTSTexts(params: {
  titulo: string;
  scenes: Array<{ titulo: string; desc: string }>;
  template: VideoTemplate;
}): string[] {
  const { titulo, scenes, template: tpl } = params;
  const total = scenes.length;
  const texts: string[] = [];

  // hook
  texts.push(fill(tpl.tts.hook, { titulo }));

  // cenas numeradas
  scenes.forEach((sc, i) => {
    texts.push(fill(tpl.tts.numbered, {
      index: i + 1,
      total,
      titulo_cena: sc.titulo,
      desc_cena: sc.desc,
    }));
  });

  // cta
  texts.push(tpl.tts.cta);

  return texts;
}

// ─── parse do título → n cenas e tipo ────────────────────────────────────────

export function parseTitleHint(titulo: string): { n: number; tipo: string } {
  const m = titulo.match(/^(\d+)\s+(forma[s]?|passo[s]?|razão|razões|dica[s]?|erro[s]?|segredo[s]?|jeito[s]?)/i);
  if (m) {
    const tipo = m[2].replace(/s$/i, '').toLowerCase();
    return { n: Math.min(Math.max(parseInt(m[1]), 2), 8), tipo };
  }
  return { n: 3, tipo: 'ponto' };
}

/** Gera cenas auto (sem AI) quando o usuário não fornece roteiro. */
export function autoScenes(titulo: string, tema: string, n: number): Array<{ titulo: string; desc: string }> {
  const { tipo } = parseTitleHint(titulo);
  const tipoUpper = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  return Array.from({ length: n }, (_, i) => ({
    titulo: `${tipoUpper} ${i + 1}`,
    desc: tema,
  }));
}
