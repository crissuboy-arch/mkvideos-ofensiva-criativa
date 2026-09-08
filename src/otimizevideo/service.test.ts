import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { OtimizevideoService } from './service.js';
import { CostAuthorizationRequiredError } from '../cost/types.js';
import { _resetLedger, costLedger } from '../cost/gate.js';

describe('OtimizevideoService', () => {
  let dataDir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'otv-test-'));
    env = { MKIVIDEOS_DATA_DIR: dataDir };
    runToolMock.mockReset();
    runToolMock.mockResolvedValue({ code: 0, stdout: '[ingest] /x/trabalho/abc123', stderr: '' });
    _resetLedger();
  });
  afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

  it('transcrever com groq SEM confirmação bloqueia e não spawna', async () => {
    const svc = new OtimizevideoService(env);
    await expect(svc.transcrever('abc123', 'groq', false)).rejects.toBeInstanceOf(CostAuthorizationRequiredError);
    expect(runToolMock).not.toHaveBeenCalled();
  });

  it('transcrever com whisper_local (grátis) roda sem confirmação', async () => {
    const svc = new OtimizevideoService(env);
    await svc.transcrever('abc123', 'whisper_local', false);
    expect(runToolMock).toHaveBeenCalledTimes(1);
    expect(costLedger()).toHaveLength(0);
  });

  it('transcrever com groq + confirmação spawna e registra custo', async () => {
    const svc = new OtimizevideoService(env);
    await svc.transcrever('abc123', 'groq', true);
    const [, args] = runToolMock.mock.calls[0];
    expect(args).toEqual(expect.arrayContaining(['transcrever', 'abc123', '--provedor', 'groq', '--config']));
    // `--config` é opção de nível raiz no otv.py → precisa vir ANTES do subcomando.
    expect(args.indexOf('--config')).toBeLessThan(args.indexOf('transcrever'));
    expect(costLedger()).toHaveLength(1);
  });

  it('pontuar com ollama (local) não passa pelo gate', async () => {
    const svc = new OtimizevideoService(env);
    await svc.pontuar('abc123', 'A', 'ollama', false);
    expect(runToolMock).toHaveBeenCalledTimes(1);
    expect(costLedger()).toHaveLength(0);
  });

  it('selecionar e render nunca pedem confirmação (sem LLM)', async () => {
    const svc = new OtimizevideoService(env);
    await svc.selecionar('abc123', 'A', 120);
    await svc.render('abc123');
    expect(runToolMock).toHaveBeenCalledTimes(2);
    expect(costLedger()).toHaveLength(0);
  });

  it('status lê plan.json e custos.json do disco', () => {
    const dir = path.join(dataDir, 'otimizevideo', 'trabalho', 'abc123');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ modo: 'A', alvo_s: 120, total_s: 118, segmentos: [{}, {}, {}] }));
    writeFileSync(path.join(dir, 'custos.json'), JSON.stringify({ transcrever: { uso: { cost: 0.02 } }, pontuar: { uso: { cost: 0.002 } } }));
    const svc = new OtimizevideoService(env);
    const s = svc.status('abc123');
    expect(s.plano).toMatchObject({ modo: 'A', segmentos: 3 });
    expect(s.custoTotalUsd).toBeCloseTo(0.022);
  });
});
