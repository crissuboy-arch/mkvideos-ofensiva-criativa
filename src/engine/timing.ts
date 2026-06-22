// Timing = fonte única de verdade. A partir das durações reais dos WAVs (ffprobe),
// calcula start/duração/fim de cada cena e o total. Áudio e animação saem daqui.
// Função pura — totalmente testável.

export interface Timing {
  LEAD: number; // visual antes da voz começar
  TAIL: number; // segura o quadro depois da voz
  FADE: number; // duração das transições de entrada/saída
}

export const DEFAULT_TIMING: Timing = { LEAD: 0.3, TAIL: 0.5, FADE: 0.35 };

export interface SceneTime {
  i: number;          // 1-based
  start: number;
  dur: number;
  audioStart: number;
  audioDur: number;
  end: number;
}

export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface Timeline {
  scenes: SceneTime[];
  total: number;
  timing: Timing;
}

/**
 * Distribui as cenas na linha do tempo a partir das durações de áudio.
 * Cada cena = LEAD + áudio + TAIL; áudio começa em (start + LEAD).
 */
export function layoutTimeline(audioDurs: number[], timing: Timing = DEFAULT_TIMING): Timeline {
  let t = 0;
  const scenes: SceneTime[] = audioDurs.map((audio, idx) => {
    const dur = timing.LEAD + audio + timing.TAIL;
    const s: SceneTime = {
      i: idx + 1,
      start: round(t),
      dur: round(dur),
      audioStart: round(t + timing.LEAD),
      audioDur: round(audio),
      end: round(t + dur),
    };
    t += dur;
    return s;
  });
  return { scenes, total: round(t), timing };
}
