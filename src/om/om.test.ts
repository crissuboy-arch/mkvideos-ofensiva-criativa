// src/om/om.test.ts — ponte OpenMontage com runTool mockado.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { runToolMock } = vi.hoisted(() => ({ runToolMock: vi.fn() }));
vi.mock('../localtools/exec.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../localtools/exec.js')>();
  return { ...actual, runTool: runToolMock, resolvePython: vi.fn().mockResolvedValue('python3') };
});

import { runOmTool, omListTools } from './bridge.js';
import { runPaidTool, PaidGateError } from './paid.js';

const okResult = {
  success: true,
  data: { output_duration: 6.16 },
  artifacts: ['/tmp/out.mp4'],
  error: null,
  cost_usd: 0,
  duration_seconds: 2,
};

describe('om/bridge', () => {
  beforeEach(() => runToolMock.mockReset());

  it('executa ferramenta como subprocesso e devolve o JSON', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: JSON.stringify(okResult), stderr: '' });
    const r = await runOmTool('silence_cutter', { input_path: 'a.mp4' });
    expect(r.success).toBe(true);
    expect(r.artifacts).toEqual(['/tmp/out.mp4']);
    const [, args, opts] = runToolMock.mock.calls[0];
    expect(args[1]).toBe('silence_cutter');           // nome da ferramenta
    expect(JSON.parse(args[2])).toMatchObject({ input_path: 'a.mp4' });
    expect(opts.env.OM_ROOT).toBeTruthy();            // fronteira via env
  });

  it('lança LocalToolError quando a ferramenta falha', async () => {
    runToolMock.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({ ...okResult, success: false, error: 'ffmpeg sumiu' }),
      stderr: '',
    });
    await expect(runOmTool('silence_cutter', {})).rejects.toThrow(/ffmpeg sumiu/);
  });

  it('omListTools lista nomes', async () => {
    runToolMock.mockResolvedValue({ code: 0, stdout: '{"tools": ["a", "b"]}', stderr: '' });
    expect(await omListTools()).toEqual(['a', 'b']);
  });
});

describe('om/paid (cost gate)', () => {
  beforeEach(() => {
    runToolMock.mockReset();
    delete process.env.MKV_OM_PAID;
  });

  it('bloqueia sem MKV_OM_PAID=1', async () => {
    await expect(runPaidTool('higgsfield_video', {}, { confirm: async () => true }))
      .rejects.toThrow(PaidGateError);
    expect(runToolMock).not.toHaveBeenCalled();
  });

  it('bloqueia se a utilizadora recusar', async () => {
    process.env.MKV_OM_PAID = '1';
    await expect(runPaidTool('higgsfield_video', {}, { confirm: async () => false }))
      .rejects.toThrow(/recusada/);
    expect(runToolMock).not.toHaveBeenCalled();
  });

  it('executa com flag + confirmação', async () => {
    process.env.MKV_OM_PAID = '1';
    runToolMock.mockResolvedValue({ code: 0, stdout: JSON.stringify(okResult), stderr: '' });
    let msg = '';
    const r = await runPaidTool('higgsfield_video', { image: 'x.png' }, {
      confirm: async (m) => { msg = m; return true; },
    });
    expect(r.success).toBe(true);
    expect(msg).toMatch(/Autorizas/);
    expect(runToolMock).toHaveBeenCalledTimes(1);
    delete process.env.MKV_OM_PAID;
  });
});
