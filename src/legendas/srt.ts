// Conversão transcrição ↔ legenda (SRT). Funções puras — sem I/O, testáveis.
// A transcrição vem do adapter otimizevideo (transcript.json: palavras {t,ini,fim}).

export interface PalavraTranscrita { t: string; ini: number; fim: number }
export interface Transcript {
  idioma?: string;
  provedor?: string;
  palavras: PalavraTranscrita[];
  fins_segmento?: number[];
}

export interface Cue { index: number; start: number; end: number; text: string }

export interface CueOptions {
  /** Máx. de caracteres por linha de legenda. */
  maxChars?: number;
  /** Duração máxima de uma legenda, em segundos. */
  maxDur?: number;
  /** Fronteiras naturais de frase (transcript.fins_segmento) — quebra preferencial. */
  segmentEnds?: number[];
}

/** Agrupa palavras em cues respeitando limite de caracteres, duração e fronteiras de frase. */
export function wordsToCues(words: PalavraTranscrita[], opts: CueOptions = {}): Cue[] {
  const maxChars = opts.maxChars ?? 42;
  const maxDur = opts.maxDur ?? 6;
  const ends = new Set((opts.segmentEnds ?? []).map((n) => Math.round(n * 1000)));
  const cues: Cue[] = [];
  let buf: PalavraTranscrita[] = [];

  const flush = (): void => {
    if (!buf.length) return;
    cues.push({
      index: cues.length + 1,
      start: buf[0].ini,
      end: buf[buf.length - 1].fim,
      text: buf.map((w) => w.t).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim(),
    });
    buf = [];
  };

  for (const w of words) {
    const tentative = [...buf, w];
    const chars = tentative.map((x) => x.t).join(' ').length;
    const dur = w.fim - (buf[0]?.ini ?? w.ini);
    if (buf.length && (chars > maxChars || dur > maxDur)) flush();
    buf.push(w);
    const isSentenceEnd = /[.!?]["')\]]?$/.test(w.t) || ends.has(Math.round(w.fim * 1000));
    if (isSentenceEnd) flush();
  }
  flush();
  return cues;
}

export function formatTimestamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rem = ms % 1000;
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(rem).padStart(3, '0')}`;
}

export function cuesToSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${c.text}\n`)
    .join('\n');
}

function parseTimestamp(v: string): number {
  const m = v.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
}

/** Parser de SRT para round-trip de edição (aceita CRLF e blocos com múltiplas linhas). */
export function parseSrt(text: string): Cue[] {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx < 0) continue;
    const [a, b] = lines[timeLineIdx].split('-->');
    cues.push({
      index: cues.length + 1,
      start: parseTimestamp(a),
      end: parseTimestamp(b),
      text: lines.slice(timeLineIdx + 1).join('\n').trim(),
    });
  }
  return cues;
}

/** Desloca todas as legendas por `deltaSeconds` (sincronização). */
export function shiftCues(cues: Cue[], deltaSeconds: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start + deltaSeconds),
    end: Math.max(0, c.end + deltaSeconds),
  }));
}
