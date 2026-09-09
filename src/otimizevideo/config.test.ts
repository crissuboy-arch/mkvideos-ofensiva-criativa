import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { safeWhisperModel, ensureConfigYaml, faseProviderEhPago, PROVIDERS_GRATIS } from './config.js';

describe('otimizevideo/config — pipeline offline seguro', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'otv-cfg-')); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  describe('safeWhisperModel', () => {
    it('MKIVIDEOS_WHISPER_MODEL explícito vence sempre', () => {
      expect(safeWhisperModel({ MKIVIDEOS_WHISPER_MODEL: 'small' })).toBe('small');
      expect(safeWhisperModel({ MKIVIDEOS_WHISPER_MODEL: '  large-v3  ' })).toBe('large-v3');
    });

    it('sem env: escolhe pela RAM total (turbo só com folga, senão base)', () => {
      const spy = vi.spyOn(os, 'totalmem');
      spy.mockReturnValue(7 * 1024 ** 3);
      expect(safeWhisperModel({})).toBe('base');
      spy.mockReturnValue(16 * 1024 ** 3);
      expect(safeWhisperModel({})).toBe('turbo');
      spy.mockRestore();
    });
  });

  describe('ensureConfigYaml', () => {
    it('gera o config com defaults 100% offline (transcrição + pontuação locais)', () => {
      const spy = vi.spyOn(os, 'totalmem').mockReturnValue(7 * 1024 ** 3);
      const dest = ensureConfigYaml({ MKIVIDEOS_DATA_DIR: tmp });
      const yaml = readFileSync(dest, 'utf-8');
      expect(yaml).toMatch(/^transcricao: whisper_local\b/m);
      expect(yaml).toMatch(/^pontuacao: local_heuristic\b/m);
      expect(yaml).toMatch(/^\s+whisper_local: base\b/m); // 7 GiB → base
      expect(yaml).toMatch(/^cta: ''$/m);
      spy.mockRestore();
    });

    it('MKIVIDEOS_WHISPER_MODEL entra no config gerado', () => {
      const dest = ensureConfigYaml({ MKIVIDEOS_DATA_DIR: tmp, MKIVIDEOS_WHISPER_MODEL: 'turbo' });
      expect(readFileSync(dest, 'utf-8')).toMatch(/^\s+whisper_local: turbo\b/m);
    });
  });

  describe('local_heuristic é gratuito (não dispara o gate de custo)', () => {
    it('faseProviderEhPago("pontuacao", "local_heuristic") === false', () => {
      expect(faseProviderEhPago('pontuacao', 'local_heuristic')).toBe(false);
      expect(PROVIDERS_GRATIS.pontuacao).toContain('local_heuristic');
      // provedores LLM seguem pagos
      expect(faseProviderEhPago('pontuacao', 'glm')).toBe(true);
      expect(faseProviderEhPago('pontuacao', 'gemini')).toBe(true);
    });
  });
});
