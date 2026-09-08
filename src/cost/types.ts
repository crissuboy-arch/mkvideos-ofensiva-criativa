// Camada comum de estimativa/registro de custo, usada por qualquer módulo que
// possa gerar cobrança (musicavideo, otimizevideo, e futuros providers pagos em
// src/engines/providers/). Regra central do projeto: NUNCA rodar um provider
// pago sem autorização explícita do usuário — ver src/cost/gate.ts.

export interface CostEstimate {
  /** Módulo de origem, ex.: 'musicavideo', 'otimizevideo'. */
  module: string;
  /** Fase/parte, ex.: 'musica', 'transcricao', 'pontuacao'. */
  phase: string;
  /** Provider concreto, ex.: 'kie:suno-v4.5', 'groq:whisper-large-v3'. */
  providerId: string;
  /** Estimativa em dólares. 0 = gratuito/local (ainda assim é bom mostrar). */
  estimatedUsd: number;
  /** Nota curta para a UI (ex.: "traz 2 faixas", "~US$0,04/hora de áudio"). */
  note?: string;
  /** false quando o provider é gratuito/local — usado para decidir se o gate de custo se aplica. */
  billable: boolean;
}

export class CostAuthorizationRequiredError extends Error {
  constructor(readonly estimate: CostEstimate) {
    super(
      `Autorização necessária: ${estimate.module}/${estimate.phase} via ${estimate.providerId} ` +
      `custa ~US$${estimate.estimatedUsd.toFixed(4)}. Confirme explicitamente antes de gerar.`,
    );
    this.name = 'CostAuthorizationRequiredError';
  }
}

export class CostCeilingExceededError extends Error {
  constructor(readonly estimate: CostEstimate, readonly ceilingUsd: number) {
    super(
      `Teto de gasto excedido: ${estimate.module}/${estimate.phase} custaria ~US$${estimate.estimatedUsd.toFixed(4)}, ` +
      `acima do teto configurado de US$${ceilingUsd.toFixed(2)}.`,
    );
    this.name = 'CostCeilingExceededError';
  }
}

export interface CostLedgerEntry extends CostEstimate {
  at: string; // ISO
  confirmedBy: 'user' | 'cli';
  projectSlug?: string;
}
