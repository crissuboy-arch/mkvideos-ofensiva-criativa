import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { concatHealth, concatProbe, concatRender, concatCheck } from './concat.js';
import { EngineNotImplementedError } from '../types.js';

let realFile: string;

beforeEach(() => {
  // Garante binário ausente: nome impossível no PATH.
  process.env.CONCAT_BIN = 'concat-bin-inexistente-xyz';
  realFile = path.join(mkdtempSync(path.join(tmpdir(), 'concat-test-')), 'x.mp4');
  writeFileSync(realFile, 'fake');
});

describe('Concat bridge (sem binário)', () => {
  it('health() = indisponível com mensagem clara', async () => {
    const h = await concatHealth();
    expect(h.available).toBe(false);
    expect(h.version).toBeNull();
    expect(h.message).toMatch(/não encontrado|NOT_IMPLEMENTED/i);
  });

  it('probe() nega com NOT_IMPLEMENTED quando o binário falta', async () => {
    await expect(concatProbe(realFile)).rejects.toBeInstanceOf(EngineNotImplementedError);
  });

  it('probe() recusa ficheiro inexistente antes de chamar o binário', async () => {
    process.env.CONCAT_BIN = 'concat';
    await expect(concatProbe('/tmp/ficheiro-que-nao-existe-xyz.mp4')).rejects.toThrow(/não existe/);
  });

  it('render() nega com NOT_IMPLEMENTED quando o binário falta', async () => {
    await expect(concatRender(realFile, path.join(tmpdir(), 'saida.mp4'))).rejects.toBeInstanceOf(
      EngineNotImplementedError,
    );
  });

  it('check() nega com NOT_IMPLEMENTED quando o binário falta', async () => {
    await expect(concatCheck(realFile)).rejects.toBeInstanceOf(EngineNotImplementedError);
  });
});
