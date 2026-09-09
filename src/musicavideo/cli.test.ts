// Regressão: um subcomando do musicavideo cujo processo Python retorna code != 0
// (erro, crash, dependência ausente como o `claude` do planner) era reportado
// como sucesso — o CLI fazia `return r.stdout || r.stderr` e saía com exit 0.
// Agora LANÇA → cli.ts imprime "❌ …" e sai com código 1.

import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { runMusicavideoCli } from './cli.js';

describe('runMusicavideoCli — propagação de falha do processo', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'mvd-cli-'));
    process.env.MKIVIDEOS_DATA_DIR = tmp;
    runToolMock.mockReset();
  });
  afterEach(() => {
    delete process.env.MKIVIDEOS_DATA_DIR;
    rmSync(tmp, { recursive: true, force: true });
  });

  it('plano com dependência ausente (code 1, stderr) → LANÇA com a mensagem', async () => {
    runToolMock.mockResolvedValue({
      code: 1, stdout: '',
      stderr: "erro: binário 'claude' não encontrado — o planner precisa do Claude Code no PATH",
    });
    await expect(runMusicavideoCli(['plano', 'uma música lo-fi', 'slug1']))
      .rejects.toThrow(/plano" falhou \(código 1\)/);
    await expect(runMusicavideoCli(['plano', 'uma música lo-fi', 'slug1']))
      .rejects.toThrow(/claude/);
  });

  it('crash sem saída (code≠0, stdout/stderr vazios) → LANÇA mesmo assim', async () => {
    runToolMock.mockResolvedValue({ code: 3221225477, stdout: '', stderr: '' });
    await expect(runMusicavideoCli(['ok', 'slug1', 'musica']))
      .rejects.toThrow(/falhou \(código 3221225477\)|não deixou saída/);
  });

  it('faz/pacote/aprova também propagam code≠0', async () => {
    runToolMock.mockResolvedValue({ code: 2, stdout: '', stderr: 'boom' });
    await expect(runMusicavideoCli(['pacote', 'slug1'])).rejects.toThrow(/falhou \(código 2\)/);
    await expect(runMusicavideoCli(['aprova', 'slug1', 'musica'])).rejects.toThrow(/boom/);
  });

  it('code === 0 → retorna a saída normalmente (não lança)', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: 'plano salvo: slug1', stderr: '' });
    const msg = await runMusicavideoCli(['plano', 'uma música', 'slug1']);
    expect(msg).toContain('plano salvo');
  });
});
