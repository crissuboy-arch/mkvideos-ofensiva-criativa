import { describe, it, expect } from 'vitest';

import { wordsToCues, cuesToSrt, parseSrt, formatTimestamp, shiftCues } from './srt.js';

const words = [
  { t: 'Olá', ini: 0.0, fim: 0.4 },
  { t: 'mundo,', ini: 0.4, fim: 0.9 },
  { t: 'isso', ini: 1.0, fim: 1.3 },
  { t: 'é', ini: 1.3, fim: 1.4 },
  { t: 'um', ini: 1.4, fim: 1.6 },
  { t: 'teste.', ini: 1.6, fim: 2.1 },
  { t: 'Segunda', ini: 2.5, fim: 3.0 },
  { t: 'frase', ini: 3.0, fim: 3.4 },
  { t: 'aqui.', ini: 3.4, fim: 3.9 },
];

describe('legendas/srt', () => {
  it('wordsToCues quebra em fim de frase', () => {
    const cues = wordsToCues(words, { maxChars: 200, maxDur: 100 });
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Olá mundo, isso é um teste.');
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBeCloseTo(2.1);
    expect(cues[1].text).toBe('Segunda frase aqui.');
  });

  it('wordsToCues respeita o limite de caracteres', () => {
    const cues = wordsToCues(words, { maxChars: 12, maxDur: 100 });
    expect(cues.length).toBeGreaterThan(2);
    for (const c of cues) expect(c.text.length).toBeLessThanOrEqual(18);
  });

  it('formatTimestamp gera HH:MM:SS,mmm', () => {
    expect(formatTimestamp(0)).toBe('00:00:00,000');
    expect(formatTimestamp(3661.5)).toBe('01:01:01,500');
  });

  it('cuesToSrt e parseSrt fazem round-trip', () => {
    const cues = wordsToCues(words, { maxChars: 200, maxDur: 100 });
    const srt = cuesToSrt(cues);
    const parsed = parseSrt(srt);
    expect(parsed).toHaveLength(cues.length);
    expect(parsed[0].text).toBe(cues[0].text);
    expect(parsed[0].start).toBeCloseTo(cues[0].start, 2);
    expect(parsed[1].end).toBeCloseTo(cues[1].end, 2);
  });

  it('parseSrt aceita CRLF e legenda de múltiplas linhas', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nlinha um\r\nlinha dois\r\n';
    const cues = parseSrt(srt);
    expect(cues[0].text).toBe('linha um\nlinha dois');
    expect(cues[0].start).toBe(1);
  });

  it('shiftCues desloca e nunca vai abaixo de zero', () => {
    const cues = [{ index: 1, start: 1, end: 2, text: 'a' }];
    expect(shiftCues(cues, 0.5)[0]).toMatchObject({ start: 1.5, end: 2.5 });
    expect(shiftCues(cues, -5)[0]).toMatchObject({ start: 0, end: 0 });
  });
});
