import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { MusicavideoService } from './service.js';
import { CostAuthorizationRequiredError } from '../cost/types.js';
import { _resetLedger, costLedger } from '../cost/gate.js';

function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

describe('MusicavideoService', () => {
  let dataDir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'mvd-test-'));
    env = { MKIVIDEOS_DATA_DIR: dataDir };
    runToolMock.mockReset();
    runToolMock.mockResolvedValue({ code: 0, stdout: 'ok', stderr: '' });
    _resetLedger();

    const dir = path.join(dataDir, 'musicavideo', 'minha-musica');
    writeJson(path.join(dir, 'plano.json'), {
      slug: 'minha-musica',
      musica: { motor: 'kie:suno-v4.5' },
      capa: { motor: 'agnes:agnes-image-2.1-flash' },
      clipe: { motor: 'agnes:agnes-video-v2.0', decupagem: [] },
    });
    writeJson(path.join(dir, 'estado.json'), {
      schema_version: '1', slug: 'minha-musica', atualizado_em: '', fase: 'plano', telegram: false, teto_usd: null,
      partes: {
        musica: { estado: 'aprovado', aprovado_em: null, ajustes: 0, tentativas: 0, custo_estimado_usd: 0.08, custo_real_usd: 0, artefato: null, erro: null, meta: {} },
        capa: { estado: 'planejado', aprovado_em: null, ajustes: 0, tentativas: 0, custo_estimado_usd: 0, custo_real_usd: 0, artefato: null, erro: null, meta: {} },
        clipe: { estado: 'planejado', aprovado_em: null, ajustes: 0, tentativas: 0, custo_estimado_usd: 0, custo_real_usd: 0, artefato: null, erro: null, meta: {} },
      },
      custo_total_usd: { estimado: 0.08, gasto: 0 },
      historico: [],
    });
  });

  afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

  it('estimarCusto lê o estado.json e soma só as partes aprovadas', () => {
    const svc = new MusicavideoService(env);
    const est = svc.estimarCusto('minha-musica');
    expect(est.phase).toBe('musica');
    expect(est.estimatedUsd).toBeCloseTo(0.08);
    expect(est.billable).toBe(true);
  });

  it('faz() SEM confirmação bloqueia e NUNCA spawna o processo', async () => {
    const svc = new MusicavideoService(env);
    await expect(svc.faz({ slug: 'minha-musica', confirmado: false }))
      .rejects.toBeInstanceOf(CostAuthorizationRequiredError);
    expect(runToolMock).not.toHaveBeenCalled();
    expect(costLedger()).toHaveLength(0);
  });

  it('faz() COM confirmação explícita spawna e registra no ledger', async () => {
    const svc = new MusicavideoService(env);
    const r = await svc.faz({ slug: 'minha-musica', confirmado: true });
    expect(r.code).toBe(0);
    expect(runToolMock).toHaveBeenCalledTimes(1);
    const [, args] = runToolMock.mock.calls[0];
    expect(args).toContain('faz');
    expect(args).toContain('minha-musica');
    expect(args).not.toContain('--aprovar'); // nunca pula o portão "ok"
    expect(args).not.toContain('--autorizo-pago'); // não usou motor pago por override
    expect(costLedger()).toHaveLength(1);
  });

  it('faz() com override de motor pago adiciona --autorizo-pago automaticamente', async () => {
    const svc = new MusicavideoService(env);
    await svc.faz({ slug: 'minha-musica', confirmado: true, motorOverride: { clipe: 'kling:kling-v2_5' } });
    const [, args] = runToolMock.mock.calls[0];
    expect(args).toContain('--autorizo-pago');
    expect(args).toContain('clipe=kling:kling-v2_5');
  });

  it('indice()/busca() leem index.jsonl direto do disco', () => {
    const idx = path.join(dataDir, 'musicavideo', 'index.jsonl');
    writeFileSync(idx, [
      JSON.stringify({ slug: 'a', titulo: 'Rock de virada', solicitacao: 'rock', estados: {}, motores: {}, custo_gasto_usd: 0.08, tags: ['rock'] }),
      JSON.stringify({ slug: 'b', titulo: 'Balada calma', solicitacao: 'balada', estados: {}, motores: {}, custo_gasto_usd: 0, tags: ['pop'] }),
    ].join('\n') + '\n');
    const svc = new MusicavideoService(env);
    expect(svc.indice(10).map((l) => l.slug)).toEqual(['b', 'a']); // mais recente primeiro
    expect(svc.busca('rock').map((l) => l.slug)).toEqual(['a']);
  });
});
