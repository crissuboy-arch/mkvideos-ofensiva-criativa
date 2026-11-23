// Converte um roteiro colado (texto livre) em cenas do motor.
// Regra simples e previsível: cada bloco separado por linha em branco é uma
// cena de conteúdo; o gerador de roteiro envolve com o hook (title) e a CTA
// da marca, como faz com o conteúdo gerado. A primeira linha do bloco vira a
// legenda curta; o bloco inteiro é a narração (TTS).

import type { SceneSpec } from '../specs/types.js';

export function roteiroParaCenas(roteiro: string): SceneSpec[] {
  const blocks = roteiro
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return blocks.map((text) => {
    const firstLine = text.split(/(?<=[.!?])\s/)[0] ?? text;
    return {
      type: 'lead',
      title: firstLine.slice(0, 80),
      narration: text,
      caption: firstLine.slice(0, 90),
    } satisfies SceneSpec;
  });
}
