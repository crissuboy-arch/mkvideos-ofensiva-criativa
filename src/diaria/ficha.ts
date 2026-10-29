// Ficha de roteiro da diária (Fase 1: sem motor de IA).
// A ficha é preenchida à mão (ou por ferramenta futura) a partir do
// Top 10 coletado. O motor de roteiro é decisão D3 futura.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Ficha, FichaItem, Top10 } from './types.js';

/** Texto de base para construir uma ficha (tudo manual nesta fase). */
export interface FichaBase {
  manchete: string;
  gancho: string;
  panorama: string;
  perguntaFinal: string;
  cta: string;
  /** Texto falado por posição de ranking (#1..#10). Em falta, usa o resumo. */
  falas?: Record<number, string>;
}

/** Constrói a ficha a partir do Top 10, com os itens em ordem de
 * APRESENTAÇÃO (#10 → #1) — a ordem em que são ditos no vídeo. */
export function fichaDeTop10(top10: Top10, base: FichaBase): Ficha {
  const itens: FichaItem[] = [...top10.itens]
    .sort((a, b) => b.posicao - a.posicao)
    .map((item) => ({
      ...item,
      fala: base.falas?.[item.posicao] ?? item.resumo,
    }));
  return {
    data: top10.data,
    modo: 'dia',
    fonte: top10.fonte,
    manchete: base.manchete,
    gancho: base.gancho,
    panorama: base.panorama,
    itens,
    perguntaFinal: base.perguntaFinal,
    cta: base.cta,
  };
}

/** Tudo o que é falado no vídeo: manchete + gancho + panorama +
 * falas dos itens (na ordem de apresentação) + pergunta final.
/// O CTA NÃO é falado — é cartão final / overlay, por isso não entra
/// na contagem de caracteres nem na regra dos algarismos. */
export function textoFalado(ficha: Ficha): string {
  return [
    ficha.manchete,
    ficha.gancho,
    ficha.panorama,
    ...ficha.itens.map((i) => i.fala),
    ficha.perguntaFinal,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escreverFicha(dir: string, ficha: Ficha): string {
  const caminho = path.join(dir, 'ficha.json');
  writeFileSync(caminho, `${JSON.stringify(ficha, null, 2)}\n`);
  return caminho;
}

export function lerFicha(caminho: string): Ficha {
  return JSON.parse(readFileSync(caminho, 'utf-8')) as Ficha;
}

export function lerTop10(caminho: string): Top10 {
  return JSON.parse(readFileSync(caminho, 'utf-8')) as Top10;
}
