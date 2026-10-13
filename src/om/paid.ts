// src/om/paid.ts — provedores PAGOS do OpenMontage atrás de cost gate.
//
// Regra permanente da Cristiane: nenhum gasto sem aprovação explícita.
// Este módulo NUNCA corre nada pago sozinho:
//   1. exige MKV_OM_PAID=1 no ambiente;
//   2. exige um callback `confirm` que a UI/CLI resolve com a utilizadora.
// Sem os dois, lança PaidGateError antes de qualquer chamada.

import { runOmTool, type OmResult } from './bridge.js';

export class PaidGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaidGateError';
  }
}

/** Ferramentas pagas conhecidas (nomes no registry do OpenMontage). */
export const PAID_TOOLS = [
  'higgsfield_video',
  'kling_video',
  'kling_official_video',
  'veo_video',
  'sora_video',
  'runway_video',
  'heygen_video',
  'minimax_video',
] as const;

export type PaidToolName = (typeof PAID_TOOLS)[number];

export interface PaidCallOptions {
  /** Chamado com a descrição do gasto; resolve true = autorizado. */
  confirm: (mensagem: string) => Promise<boolean>;
  timeoutMs?: number;
}

/**
 * Corre uma ferramenta paga. A autorização é sempre explícita e por chamada.
 */
export async function runPaidTool(
  name: PaidToolName,
  inputs: Record<string, unknown>,
  opts: PaidCallOptions,
): Promise<OmResult> {
  if (process.env.MKV_OM_PAID !== '1') {
    throw new PaidGateError(
      `provedor pago "${name}" bloqueado: define MKV_OM_PAID=1 para ativar (e confirma cada chamada).`,
    );
  }
  const ok = await opts.confirm(
    `Autorizas a chamada paga "${name}"? Custo estimado: variável por provedor. ` +
      `Nada é cobrado sem este "sim".`,
  );
  if (!ok) {
    throw new PaidGateError(`chamada paga "${name}" recusada pela utilizadora.`);
  }
  return runOmTool(name, inputs, { timeoutMs: opts.timeoutMs });
}
