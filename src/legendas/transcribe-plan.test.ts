import { describe, it, expect } from 'vitest';

import {
  buildTranscribePlan, formatDuration, costLabel, GROQ_USD_PER_HOUR, type PlanDeps,
} from './transcribe-plan.js';

const base = (over: Partial<PlanDeps> = {}, env: NodeJS.ProcessEnv = {}): [string, NodeJS.ProcessEnv, PlanDeps] => [
  'C:\\videos\\aula.mp4',
  env,
  {
    otvPresent: () => true,
    probeDuration: async () => 1800, // 30 min
    probeModule: async () => false,
    ...over,
  },
];

describe('formatDuration', () => {
  it('formata mm:ss e h:mm:ss', () => {
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
});

describe('costLabel', () => {
  const p = (o: Partial<Parameters<typeof costLabel>[0]>): Parameters<typeof costLabel>[0] =>
    ({ id: 'groq', label: '', kind: 'paid', available: true, estimatedUsd: null, note: '', ...o });
  it('local → grátis; pago sem duração → indisponível; pago pequeno → < US$ 0,0001', () => {
    expect(costLabel(p({ kind: 'local', estimatedUsd: 0 }))).toBe('grátis');
    expect(costLabel(p({ kind: 'paid', estimatedUsd: null }))).toBe('estimativa indisponível');
    expect(costLabel(p({ kind: 'paid', estimatedUsd: 0.0000222 }))).toBe('< US$ 0,0001');
    expect(costLabel(p({ kind: 'paid', estimatedUsd: 0.0123 }))).toBe('~US$ 0.0123');
  });
});

describe('buildTranscribePlan', () => {
  it('estima o custo da Groq pela duração real (US$0,04/h, sem inventar)', async () => {
    const plan = await buildTranscribePlan(...base({ probeDuration: async () => 3600 }));
    const groq = plan.providers.find((p) => p.id === 'groq')!;
    expect(groq.kind).toBe('paid');
    expect(groq.estimatedUsd).toBeCloseTo(GROQ_USD_PER_HOUR); // 1 h → ~US$0,04
    expect(plan.durationLabel).toBe('1:00:00');
  });

  it('sem duração → custo da Groq é null ("estimativa indisponível")', async () => {
    const plan = await buildTranscribePlan(...base({ probeDuration: async () => { throw new Error('ffprobe ausente'); } }));
    const groq = plan.providers.find((p) => p.id === 'groq')!;
    expect(groq.estimatedUsd).toBeNull();
    expect(groq.note).toMatch(/indisponível/);
    expect(plan.durationSeconds).toBeNull();
    expect(plan.durationLabel).toBe('desconhecida');
  });

  it('prioriza o provedor local quando instalado e funcional', async () => {
    const plan = await buildTranscribePlan(...base({ probeModule: async (m) => m === 'whisper' }));
    expect(plan.recommendedProviderId).toBe('whisper_local');
    expect(plan.localReady).toBe(true);
    const wl = plan.providers.find((p) => p.id === 'whisper_local')!;
    expect(wl.available).toBe(true);
    expect(wl.estimatedUsd).toBe(0);
  });

  it('sem provedor local → recomenda Groq e explica o que instalar', async () => {
    const plan = await buildTranscribePlan(...base({}, { GROQ_API_KEY: 'x' }));
    expect(plan.recommendedProviderId).toBe('groq');
    expect(plan.localReady).toBe(false);
    expect(plan.localHint).toMatch(/openai-whisper/);
    const wl = plan.providers.find((p) => p.id === 'whisper_local')!;
    expect(wl.available).toBe(false);
    expect(wl.missing).toMatch(/pip install/);
  });

  it('Groq indisponível sem GROQ_API_KEY, com instrução clara', async () => {
    const plan = await buildTranscribePlan(...base({}, {}));
    const groq = plan.providers.find((p) => p.id === 'groq')!;
    expect(groq.available).toBe(false);
    expect(groq.missing).toMatch(/GROQ_API_KEY/);
  });

  it('módulo otimizevideo ausente → todos indisponíveis', async () => {
    const plan = await buildTranscribePlan(...base({ otvPresent: () => false, probeModule: async () => true }, { GROQ_API_KEY: 'x' }));
    expect(plan.providers.every((p) => !p.available)).toBe(true);
    expect(plan.providers.every((p) => /otimizevideo ausente/.test(p.missing ?? ''))).toBe(true);
  });

  it('não executa transcrição nem gasta — só descreve', async () => {
    let ran = false;
    const plan = await buildTranscribePlan(...base({
      probeModule: async () => { ran = true; return false; },
    }));
    // probeModule é só a checagem de "está instalado?"; nenhuma transcrição roda aqui.
    expect(ran).toBe(true);
    expect(plan.providers.map((p) => p.id)).toEqual(['whisper_local', 'whisperx', 'groq']);
  });
});
