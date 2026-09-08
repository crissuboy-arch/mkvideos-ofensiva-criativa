import { describe, it, expect } from 'vitest';

import { parseNodeMajor, formatDoctor, runDoctor, type DoctorReport } from './doctor.js';

describe('doctor', () => {
  it('parseNodeMajor extrai o major', () => {
    expect(parseNodeMajor('v24.15.0')).toBe(24);
    expect(parseNodeMajor('20.0.0')).toBe(20);
    expect(parseNodeMajor('nada')).toBe(0);
  });

  it('formatDoctor agrupa e marca falhas', () => {
    const report: DoctorReport = {
      ok: false,
      checks: [
        { name: 'Node.js', group: 'node', ok: true, required: true, detail: 'v24' },
        { name: 'ffmpeg', group: 'mídia', ok: false, required: true, detail: 'ausente' },
        { name: 'Codex CLI', group: 'IA', ok: false, required: false, detail: 'ausente' },
      ],
    };
    const out = formatDoctor(report);
    expect(out).toContain('MÍDIA');
    expect(out).toContain('❌ ffmpeg');
    expect(out).toContain('⚠️  Codex CLI');
    expect(out).toContain('requisitos obrigatórios faltando');
  });

  it('runDoctor devolve checagens obrigatórias', async () => {
    const r = await runDoctor({ AI_PROVIDER: 'openai' } as NodeJS.ProcessEnv);
    const names = r.checks.map((c) => c.name);
    expect(names).toContain('Node.js');
    expect(names).toContain('ffmpeg');
    expect(names).toContain('modules/content2video');
    expect(typeof r.ok).toBe('boolean');
  }, 20_000);
});
