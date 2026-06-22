// Vocabulário de movimento (M.*) + transições (TRANS).
// Cada helper devolve uma LINHA de código GSAP (string) que o composer injeta no
// <script> da composição. Toda cena compõe a partir daqui — nada de tween solto.
// Os deslocamentos encolhem no 9:16 (VMOVE) para não estourar a margem.

import { round } from './timing.js';
import type { TransType } from '../specs/types.js';

export const EASE = {
  out: 'power3.out',
  soft: 'power2.out',
  in: 'power2.in',
  back: 'back.out(1.6)',
  expo: 'expo.out',
  pop: 'back.out(1.8)',
} as const;

export interface MotionOpts {
  x?: number; y?: number; scale?: number; d?: number; ease?: string;
  stagger?: number; letter?: string;
  times?: number; dist?: number; repeat?: number; s?: number;
  blur?: number; color?: string; from?: number; suffix?: string; steps?: number; a?: number;
}

export type Sel = string | string[];

export interface Motion {
  reveal(sel: Sel, at: number, o?: MotionOpts): string;
  sweep(sel: Sel, at: number, o?: MotionOpts): string;
  type(sel: Sel, at: number, o?: MotionOpts): string;
  blink(sel: Sel, at: number, o?: MotionOpts): string;
  float(sel: Sel, at: number, o?: MotionOpts): string;
  pulse(sel: Sel, at: number, o?: MotionOpts): string;
  glow(sel: Sel, at: number, o?: MotionOpts): string;
  ping(sel: Sel, at: number, o?: MotionOpts): string;
  tint(sel: Sel, at: number, o?: MotionOpts): string;
  bar(sel: Sel, at: number, to: number, o?: MotionOpts): string;
  countUp(sel: Sel, at: number, to: number, o?: MotionOpts): string;
  set(sel: Sel, at: number, props: string): string;
  raw(s: string): string;
}

/** Cria o vocabulário de movimento ajustado ao formato (vertical encolhe deslocamentos). */
export function createMotion(vertical: boolean): Motion {
  const VMOVE = vertical ? 0.7 : 1;
  const mv = (v: number) => Math.round(v * VMOVE);
  const J = (s: Sel) => JSON.stringify(s);

  return {
    reveal(sel, at, o = {}) {
      const f = ['opacity:0'];
      if (o.x) f.push(`x:${mv(o.x)}`);
      if (o.y) f.push(`y:${mv(o.y)}`);
      if (o.scale != null) f.push(`scale:${o.scale}`);
      if (o.letter) f.push(`letterSpacing:${J(o.letter)}`);
      const ex = o.stagger ? `,stagger:${o.stagger}` : '';
      return `tl.from(${J(sel)},{${f.join(',')},duration:${o.d ?? 0.55},ease:"${o.ease ?? EASE.out}"${ex}},${at});`;
    },
    sweep(sel, at, o = {}) {
      return `tl.fromTo(${J(sel)},{scaleX:0},{scaleX:1,duration:${o.d ?? 0.7},ease:"${o.ease ?? EASE.expo}",transformOrigin:"left center"},${at});`;
    },
    type(sel, at, o = {}) {
      return `tl.fromTo(${J(sel)},{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:${o.d ?? 1.1},ease:"steps(${o.steps ?? 22})"},${at});`;
    },
    blink(sel, at, o = {}) {
      return `tl.fromTo(${J(sel)},{opacity:1},{opacity:0,duration:${o.d ?? 0.5},repeat:${o.times ?? 10},yoyo:true,ease:"none"},${at});`;
    },
    float(sel, at, o = {}) {
      return `tl.to(${J(sel)},{y:"-=${mv(o.dist ?? 10)}",duration:${o.d ?? 1.6},repeat:${o.repeat ?? 4},yoyo:true,ease:"sine.inOut"},${at});`;
    },
    pulse(sel, at, o = {}) {
      return `tl.fromTo(${J(sel)},{scale:1},{scale:${o.s ?? 1.08},duration:${o.d ?? 0.35},repeat:${(o.times ?? 3) * 2 - 1},yoyo:true,ease:"sine.inOut"},${at});`;
    },
    glow(sel, at, o = {}) {
      const c = o.color ?? '201,162,39';
      return `tl.fromTo(${J(sel)},{filter:"drop-shadow(0 0 0px rgba(${c},0))"},{filter:"drop-shadow(0 0 ${o.blur ?? 26}px rgba(${c},.55))",duration:${o.d ?? 1.1},repeat:${o.times ?? 4},yoyo:true,ease:"sine.inOut"},${at});`;
    },
    ping(sel, at, o = {}) {
      return `tl.fromTo(${J(sel)},{scale:.6,opacity:.7},{scale:1.5,opacity:0,duration:${o.d ?? 1.6},repeat:${o.times ?? 4},ease:"sine.out"},${at});`;
    },
    tint(sel, at, o = {}) {
      const c = o.color ?? '91,200,175';
      return `tl.fromTo(${J(sel)},{backgroundColor:"rgba(${c},0)"},{backgroundColor:"rgba(${c},${o.a ?? 0.14})",duration:${o.d ?? 0.5},repeat:${o.times ?? 5},yoyo:true,ease:"sine.inOut"},${at});`;
    },
    bar(sel, at, to, o = {}) {
      return `tl.fromTo(${J(sel)},{scaleX:0},{scaleX:${to},duration:${o.d ?? 1.1},ease:"${o.ease ?? EASE.soft}",transformOrigin:"left center"},${at});`;
    },
    countUp(sel, at, to, o = {}) {
      return `tl.to({v:${o.from ?? 0}},{v:${to},duration:${o.d ?? 1.2},ease:"${o.ease ?? EASE.soft}",onUpdate(){var e=document.querySelector(${J(sel)});if(e)e.textContent=Math.round(this.targets()[0].v)+${JSON.stringify(o.suffix ?? '')};}},${at});`;
    },
    set(sel, at, props) {
      return `tl.to(${J(sel)},{${props},duration:0.4},${at});`;
    },
    raw(s) { return s; },
  };
}

// ─── transições entre cenas ───────────────────────────────────────────────────
// Transform vai no CLIP (.scene); opacidade no .scene-inner → não conflita com Ken Burns.

type TransFn = (clip: string, inner: string, at: number, d: number) => string[];
interface TransPair { in: TransFn; out: TransFn; }

const J = (s: string) => JSON.stringify(s);

export const TRANS: Record<TransType, TransPair> = {
  fade: {
    in: (_c, n, at, d) => [`tl.fromTo(${J(n)},{opacity:0},{opacity:1,duration:${d},ease:"power2.out"},${at});`],
    out: (_c, n, at, d) => [`tl.to(${J(n)},{opacity:0,duration:${d},ease:"power2.in"},${at});`],
  },
  push: {
    in: (c, n, at, d) => [`tl.set(${J(n)},{opacity:1},${at});`, `tl.fromTo(${J(c)},{xPercent:110},{xPercent:0,duration:${d},ease:"power3.out"},${at});`],
    out: (c, _n, at, d) => [`tl.to(${J(c)},{xPercent:-110,duration:${d},ease:"power3.in"},${at});`],
  },
  slideUp: {
    in: (c, n, at, d) => [`tl.set(${J(n)},{opacity:1},${at});`, `tl.fromTo(${J(c)},{yPercent:110},{yPercent:0,duration:${d},ease:"power3.out"},${at});`],
    out: (c, _n, at, d) => [`tl.to(${J(c)},{yPercent:-110,duration:${d},ease:"power3.in"},${at});`],
  },
  zoom: {
    in: (c, n, at, d) => [`tl.fromTo(${J(n)},{opacity:0},{opacity:1,duration:${d},ease:"power2.out"},${at});`, `tl.fromTo(${J(c)},{scale:0.7},{scale:1,duration:${d},ease:"power3.out"},${at});`],
    out: (c, n, at, d) => [`tl.to(${J(n)},{opacity:0,duration:${d},ease:"power2.in"},${at});`, `tl.to(${J(c)},{scale:1.35,duration:${d},ease:"power3.in"},${at});`],
  },
  wipe: {
    in: (c, n, at, d) => [`tl.set(${J(n)},{opacity:1},${at});`, `tl.fromTo(${J(c)},{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:${d},ease:"power2.inOut"},${at});`],
    out: (c, _n, at, d) => [`tl.to(${J(c)},{clipPath:"inset(0 0 0 100%)",duration:${d},ease:"power2.inOut"},${at});`],
  },
  fadeBlack: {
    in: (_c, n, at, d) => [`tl.fromTo(${J(n)},{opacity:0},{opacity:1,duration:${round(d * 0.6)},ease:"power2.out"},${round(at + d * 0.4)});`, `tl.fromTo("#tdip",{opacity:1},{opacity:0,duration:${d},ease:"power2.out",overwrite:"auto"},${at});`],
    out: (_c, n, at, d) => [`tl.to(${J(n)},{opacity:0,duration:${round(d * 0.6)},ease:"power2.in"},${at});`, `tl.fromTo("#tdip",{opacity:0},{opacity:1,duration:${d},ease:"power2.in",overwrite:"auto"},${at});`],
  },
};

/** Resolve o tipo de transição válido (default fade). */
export function transOf(t?: TransType): TransType {
  return t && TRANS[t] ? t : 'fade';
}
