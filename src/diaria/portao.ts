// Portão de roteiro da diária — validador automático da ficha.
/// Adaptado dos 13 cheques do gitbombando. O portão NÃO publica nada:
/// devolve a lista de falhas (vazia = aprovado). Quem publica, mais
/// tarde e sempre com go por edição, é outro estágio (fora da Fase 1).

import type { Ficha, GateResult } from './types.js';
import { textoFalado } from './ficha.js';

const CTA_PROIBIDO = 'inema.club';

function semAcentos(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function contarPalavras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Valida uma ficha. Cada regra devolve no máximo uma falha, com o
 * motivo exato, para a correção ser imediata. */
export function validarFicha(ficha: Ficha): GateResult {
  const falhas: string[] = [];

  if (ficha.modo !== 'dia') falhas.push(`modo "${ficha.modo}" inválido; nesta fase só "dia"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ficha.data ?? '')) {
    falhas.push(`data "${ficha.data}" inválida; formato esperado YYYY-MM-DD`);
  }

  // Ordem de apresentação #10 → #1, sem faltas nem repetidos.
  const posicoes = ficha.itens.map((i) => i.posicao);
  const esperado = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  if (posicoes.length !== 10) {
    falhas.push(`a ficha tem ${posicoes.length} itens; precisa de 10`);
  } else if (!posicoes.every((p, i) => p === esperado[i])) {
    const vistos = new Set<number>();
    const repetidos = posicoes.filter((p) => (vistos.has(p) ? true : (vistos.add(p), false)));
    const faltas = esperado.filter((p) => !posicoes.includes(p));
    if (repetidos.length > 0) falhas.push(`posições repetidas: ${[...new Set(repetidos)].join(', ')}`);
    if (faltas.length > 0) falhas.push(`posições em falta: ${faltas.join(', ')}`);
    if (repetidos.length === 0 && faltas.length === 0) {
      falhas.push(`ordem errada (esperado #10 → #1); obtido: ${posicoes.join(', ')}`);
    }
  }

  for (const item of ficha.itens) {
    if (!item.titulo?.trim()) falhas.push(`item #${item.posicao} sem título`);
    if (!item.resumo?.trim()) falhas.push(`item #${item.posicao} sem resumo`);
    if (!item.url?.trim()) falhas.push(`item #${item.posicao} sem url`);
    if (!item.fala?.trim()) falhas.push(`item #${item.posicao} sem fala`);
    if (item.pontos < 0 || item.comentarios < 0) {
      falhas.push(`item #${item.posicao} com pontos/comentários negativos`);
    }
  }

  if (!ficha.manchete?.trim()) {
    falhas.push('manchete vazia');
  } else if (contarPalavras(ficha.manchete) > 6) {
    falhas.push(
      `manchete com ${contarPalavras(ficha.manchete)} palavras; máximo 6`,
    );
  }
  if (!ficha.gancho?.trim()) falhas.push('gancho vazio');
  if (!ficha.panorama?.trim()) falhas.push('panorama vazio');
  if (!ficha.perguntaFinal?.trim()) falhas.push('pergunta final vazia');

  const fala = textoFalado(ficha);
  if (fala.length < 1300 || fala.length > 2500) {
    falhas.push(`texto falado com ${fala.length} caracteres; precisa de 1300–2500`);
  }
  const digitos = fala.match(/\d+/g);
  if (digitos) {
    falhas.push(`algarismos na fala (escrever por extenso): ${[...new Set(digitos)].join(', ')}`);
  }
  // "você" testado sem acentos, para "voce" também contar.
  if (!/\bvoce\b/.test(semAcentos(fala))) {
    falhas.push('fala sem "você" (tom: falar com quem vê, não descrever)');
  }

  // CTA: obrigatório, configurável — e o do Nei é proibido aqui.
  if (!ficha.cta?.trim()) {
    falhas.push('CTA ausente; indicar o CTA da Cristiane na ficha');
  } else if (ficha.cta.toLowerCase().includes(CTA_PROIBIDO)) {
    falhas.push(`CTA proibido (${CTA_PROIBIDO} é do Nei, não da Cristiane)`);
  }
  if (fala.toLowerCase().includes(CTA_PROIBIDO)) {
    falhas.push(`texto falado contém ${CTA_PROIBIDO} (proibido)`);
  }

  return { ok: falhas.length === 0, falhas };
}
