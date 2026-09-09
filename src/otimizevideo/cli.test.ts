// Regressão: uma fase do OtimizeVideo que retorna code != 0 (inclui crash nativo
// do Python — ex.: segfault do whisper por falta de memória, que o Node reporta
// como exit 3221225477 e stderr vazio) NUNCA pode ser apresentada como concluída.
// Antes: `mkivideos otimizevideo transcrever` terminava com saída em branco e
// exit 0. Agora: lança → cli.ts imprime "❌ …" e sai com código 1.

import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { runOtimizevideoCli } from './cli.js';
import { _resetLedger } from '../cost/gate.js';

describe('runOtimizevideoCli — propagação de falha das fases', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'otv-cli-'));
    process.env.MKIVIDEOS_DATA_DIR = tmp;
    runToolMock.mockReset();
    _resetLedger();
  });
  afterEach(() => {
    delete process.env.MKIVIDEOS_DATA_DIR;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('crash do subprocesso (code≠0, sem saída) → LANÇA, não retorna sucesso', async () => {
    runToolMock.mockResolvedValue({
      code: 3221225477, // 0xC0000005 (access violation) — como o Node reporta um segfault no Windows
      stdout: '',
      stderr: 'processo terminou anormalmente (código 3221225477) sem nenhuma saída — causa provável: crash nativo (ex.: memória insuficiente).',
    });
    await expect(runOtimizevideoCli(['transcrever', 'vid1', '--provedor', 'whisper_local']))
      .rejects.toThrow(/falhou \(código 3221225477\)/);
    await expect(runOtimizevideoCli(['transcrever', 'vid1', '--provedor', 'whisper_local']))
      .rejects.toThrow(/crash nativo|memória/i);
  });

  it('fase com stderr útil → a mensagem do erro carrega o stderr', async () => {
    runToolMock.mockResolvedValue({ code: 1, stdout: '', stderr: 'Traceback (most recent call last):\n  RuntimeError: transcrição com só 3 palavras' });
    await expect(runOtimizevideoCli(['cenas', 'vid1']))
      .rejects.toThrow(/transcrição com só 3 palavras/);
  });

  it('code≠0 também bloqueia selecionar/render (fases "grátis")', async () => {
    runToolMock.mockResolvedValue({ code: 2, stdout: '', stderr: 'plan.json sem segmentos' });
    await expect(runOtimizevideoCli(['selecionar', 'vid1'])).rejects.toThrow(/falhou \(código 2\)/);
    await expect(runOtimizevideoCli(['render', 'vid1'])).rejects.toThrow(/plan\.json sem segmentos/);
  });

  it('code === 0 → retorna a saída normalmente (não lança)', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: '/x/trabalho/vid1/transcript.json', stderr: '' });
    const msg = await runOtimizevideoCli(['transcrever', 'vid1', '--provedor', 'whisper_local']);
    expect(msg).toContain('transcript.json');
  });

  it('ingest com id detectado e code 0 → prefixa "id: …"', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: '[ingest] /x/trabalho/meu-video', stderr: '' });
    const msg = await runOtimizevideoCli(['ingest', '/tmp/meu-video.mp4']);
    expect(msg).toMatch(/id: meu-video/);
  });
});
