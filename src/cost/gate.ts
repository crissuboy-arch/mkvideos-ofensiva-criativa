// Gate de custo: qualquer chamada que vá gastar dinheiro passa por aqui antes
// de spawnar o processo do provider. `confirmed` só é true quando o usuário
// clicou "autorizo o gasto" no painel (ou passou --autorizo-gasto na CLI) —
// nunca é assumido como default.

import { CostAuthorizationRequiredError, CostCeilingExceededError, type CostEstimate } from './types.js';

export interface GateOptions {
  /** true só quando o usuário confirmou explicitamente este gasto específico. */
  confirmed: boolean;
  /** Teto opcional (env MKIVIDEOS_COST_CEILING_USD ou por chamada). Aplica mesmo se confirmed. */
  ceilingUsd?: number;
}

/** Lança se a geração não puder prosseguir. Não lança (retorna void) se puder. */
export function requireAuthorization(estimate: CostEstimate, opts: GateOptions): void {
  if (opts.ceilingUsd != null && estimate.estimatedUsd > opts.ceilingUsd) {
    throw new CostCeilingExceededError(estimate, opts.ceilingUsd);
  }
  if (estimate.billable && !opts.confirmed) {
    throw new CostAuthorizationRequiredError(estimate);
  }
}

/** Teto global configurado via env (opcional). */
export function ceilingFromEnv(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const n = Number(env.MKIVIDEOS_COST_CEILING_USD);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const ledger: import('./types.js').CostLedgerEntry[] = [];

/** Registro em memória (por processo) do que foi de fato autorizado — usado pela UI/relatório. */
export function recordAuthorized(estimate: CostEstimate, projectSlug?: string): void {
  ledger.push({ ...estimate, at: new Date().toISOString(), confirmedBy: 'user', projectSlug });
}

export function costLedger(): readonly import('./types.js').CostLedgerEntry[] {
  return ledger;
}

/** Só para testes. */
export function _resetLedger(): void {
  ledger.length = 0;
}
