// src/yt/yt.test.ts — hooks + cortes com runTool mockado.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { scoreHooks, bestHook } from './hooks.js';
import { editDecisionList } from './cuts.js';

const HOOK_OUT = (score: number, verdict = 'WEAK') =>
  `  algum gancho\n  ---\n    VERDICT       ${score}  ${verdict}\n    weakest      CURIOSITY - corta\n`;

describe('yt/hooks', () => {
  beforeEach(() => runToolMock.mockReset());

  it('pontua e ordena por nota decrescente', async () => {
    runToolMock
      .mockResolvedValueOnce({ code: 0, stdout: HOOK_OUT(42), stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: HOOK_OUT(87, 'STRONG'), stderr: '' });
    const res = await scoreHooks(['fraco', 'forte']);
    expect(res[0]).toMatchObject({ hook: 'forte', score: 87, verdict: 'STRONG' });
    expect(res[1].score).toBe(42);
    expect(runToolMock).toHaveBeenCalledTimes(2);
    // chamado como subprocesso, nunca importado
    expect(runToolMock.mock.calls[0][0]).toBe('python3');
    expect(String(runToolMock.mock.calls[0][1]).includes('hookscore.py')).toBe(true);
  });

  it('bestHook devolve null em lista vazia', async () => {
    expect(await bestHook([])).toBeNull();
    expect(runToolMock).not.toHaveBeenCalled();
  });

  it('lança LocalToolError se o script falhar', async () => {
    runToolMock.mockResolvedValue({ code: 1, stdout: '', stderr: 'boom' });
    await expect(scoreHooks(['x'])).rejects.toThrow(/hookscore falhou/);
  });
});

describe('yt/cuts', () => {
  beforeEach(() => runToolMock.mockReset());

  it('parseia o JSON do deadair', async () => {
    const edl = {
      source: 'a.srt', duration: 8, removed: 0.6, out: 7.4,
      cuts: [{ kind: 'DEAD', start: 2.7, end: 3.3, why: '1.00s gap' }],
    };
    runToolMock.mockResolvedValue({ code: 0, stdout: JSON.stringify(edl), stderr: '' });
    const res = await editDecisionList('/tmp/a.srt');
    expect(res.cuts).toHaveLength(1);
    expect(res.cuts[0]).toMatchObject({ kind: 'DEAD', start: 2.7 });
    expect(res.removed).toBe(0.6);
    expect(String(runToolMock.mock.calls[0][1]).includes('deadair.py')).toBe(true);
  });

  it('lança em JSON inesperado', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: '{"cuts": "x"}', stderr: '' });
    await expect(editDecisionList('/tmp/a.srt')).rejects.toThrow();
  });
});
