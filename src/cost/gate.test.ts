import { describe, it, expect, beforeEach } from 'vitest';

import { requireAuthorization, ceilingFromEnv, recordAuthorized, costLedger, _resetLedger } from './gate.js';
import { CostAuthorizationRequiredError, CostCeilingExceededError, type CostEstimate } from './types.js';

const paid: CostEstimate = { module: 'musicavideo', phase: 'musica', providerId: 'kie:suno-v4.5', estimatedUsd: 0.08, billable: true };
const free: CostEstimate = { module: 'musicavideo', phase: 'capa', providerId: 'agnes:agnes-image-2.1-flash', estimatedUsd: 0, billable: false };

describe('cost gate', () => {
  beforeEach(() => _resetLedger());

  it('bloqueia provider pago sem confirmação', () => {
    expect(() => requireAuthorization(paid, { confirmed: false })).toThrow(CostAuthorizationRequiredError);
  });

  it('libera provider pago com confirmação explícita', () => {
    expect(() => requireAuthorization(paid, { confirmed: true })).not.toThrow();
  });

  it('provider gratuito nunca exige confirmação', () => {
    expect(() => requireAuthorization(free, { confirmed: false })).not.toThrow();
  });

  it('teto bloqueia mesmo com confirmação explícita', () => {
    expect(() => requireAuthorization(paid, { confirmed: true, ceilingUsd: 0.05 })).toThrow(CostCeilingExceededError);
  });

  it('teto não bloqueia estimativa dentro do limite', () => {
    expect(() => requireAuthorization(paid, { confirmed: true, ceilingUsd: 1 })).not.toThrow();
  });

  it('ceilingFromEnv lê MKIVIDEOS_COST_CEILING_USD', () => {
    expect(ceilingFromEnv({ MKIVIDEOS_COST_CEILING_USD: '2.5' } as NodeJS.ProcessEnv)).toBe(2.5);
    expect(ceilingFromEnv({} as NodeJS.ProcessEnv)).toBeUndefined();
    expect(ceilingFromEnv({ MKIVIDEOS_COST_CEILING_USD: 'abc' } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it('recordAuthorized/costLedger registram o que foi autorizado', () => {
    expect(costLedger()).toHaveLength(0);
    recordAuthorized(paid, 'meu-slug');
    expect(costLedger()).toHaveLength(1);
    expect(costLedger()[0]).toMatchObject({ providerId: 'kie:suno-v4.5', projectSlug: 'meu-slug' });
  });
});
