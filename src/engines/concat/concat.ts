// Bridge para o Concat — editor de vídeo livre (alternativa ao CapCut).
// Upstream: https://github.com/jub0t/Concat · espelho com guia PT:
// https://github.com/inematds/concat
//
// LICENÇA (lida no código-fonte, 2026-10-18): AGPL-3.0-or-later COM a
// "Concat Plugin Exception" — módulos independentes que falam com o Concat
// exclusivamente via API/CLI/IPC NÃO são contaminados pelo AGPL.
// POR ISSO: este módulo NUNCA copia código do Concat; fala apenas com o
// binário `concat` (crate concat-cli) como processo externo. O núcleo MIT
// do MKVideos permanece limpo. Ver docs/providers-longcat-concat.md.
//
// Comandos do concat-cli: probe, render, api, serve, preview, check.
// VERIFICAÇÃO: interface lida no código-fonte; nenhum teste real executado
// (exige o binário instalado).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

import { EngineNotImplementedError } from '../types.js';

const run = promisify(execFile);

export const CONCAT_SETUP_MSG =
  'Concat não encontrado. Instale o binário `concat` (https://concatenate.pages.dev/ ou ' +
  'cargo install a partir de https://github.com/jub0t/Concat) e/ou defina CONCAT_BIN no .env. ' +
  'Detalhes em docs/providers-longcat-concat.md';

function concatBin(): string {
  return process.env.CONCAT_BIN || 'concat';
}

async function runConcat(args: string[], opts: { timeoutMs?: number } = {}): Promise<string> {
  try {
    const { stdout, stderr } = await run(concatBin(), args, {
      timeout: opts.timeoutMs ?? 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout + stderr;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT|not found/i.test(msg)) {
      throw new EngineNotImplementedError(`Concat: binário não encontrado. ${CONCAT_SETUP_MSG}`);
    }
    throw new EngineNotImplementedError(`Concat falhou (${args[0]}): ${msg}`);
  }
}

export interface ConcatHealth {
  available: boolean;
  /** Versão reportada pelo binário (quando disponível). */
  version: string | null;
  message: string;
}

/** Verifica se o binário `concat` responde (sem executar render). */
export async function concatHealth(): Promise<ConcatHealth> {
  try {
    const out = await runConcat(['--version'], { timeoutMs: 15_000 });
    const m = out.match(/(\d+\.\d+\.\d+)/);
    return { available: true, version: m ? m[1] : null, message: 'Concat CLI responde.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { available: false, version: null, message: msg };
  }
}

/** Inspeciona um ficheiro de mídia (equivale a `concat probe <path>`). */
export async function concatProbe(mediaPath: string): Promise<string> {
  if (!existsSync(mediaPath)) {
    throw new EngineNotImplementedError(`Concat probe: ficheiro não existe: ${mediaPath}`);
  }
  return runConcat(['probe', mediaPath], { timeoutMs: 60_000 });
}

/**
 * Render headless de um projeto Concat (equivale a `concat render`).
 * `projectRef` é o que o CLI espera (ficheiro de projeto ou diretório);
 * `output` é o MP4 de saída. NÃO substitui ficheiros sem output explícito.
 */
export async function concatRender(
  projectRef: string,
  output: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  if (!existsSync(projectRef)) {
    throw new EngineNotImplementedError(`Concat render: projeto não existe: ${projectRef}`);
  }
  return runConcat(['render', projectRef, '--output', output], opts);
}

/** Valida um projeto sem renderizar (equivale a `concat check <path>`). */
export async function concatCheck(projectRef: string): Promise<string> {
  if (!existsSync(projectRef)) {
    throw new EngineNotImplementedError(`Concat check: projeto não existe: ${projectRef}`);
  }
  return runConcat(['check', projectRef], { timeoutMs: 60_000 });
}
