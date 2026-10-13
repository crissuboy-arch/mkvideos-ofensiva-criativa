// src/om/bridge.ts — ponte para ferramentas OpenMontage (AGPLv3).
//
// FRONTEIRA DE LICENÇA: este módulo NUNCA importa código do OpenMontage.
// Executa `tools/om/run_tool.py` como processo separado (via runTool,
// o mesmo padrão do ffmpeg), que por sua vez corre DENTRO da árvore
// OpenMontage (MKV_OM_ROOT, omissão: ~/workspace/open-montagen).
// A comunicação é só JSON via stdio. O MKVideos continua MIT.

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool, resolvePython, LocalToolError } from '../localtools/exec.js';

const TOOLS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'tools', 'om',
);

export function omRoot(): string {
  return process.env.MKV_OM_ROOT ?? path.join(os.homedir(), 'workspace', 'open-montagen');
}

export interface OmResult {
  success: boolean;
  data: Record<string, unknown>;
  artifacts: string[];
  error: string | null;
  cost_usd: number;
  duration_seconds: number;
}

/** Lista as ferramentas descobertas no OpenMontage. */
export async function omListTools(): Promise<string[]> {
  const python = await resolvePython();
  const r = await runTool(python, [path.join(TOOLS_DIR, 'run_tool.py'), '--list'], {
    cwd: TOOLS_DIR,
    timeoutMs: 120_000,
    env: { ...process.env, OM_ROOT: omRoot() },
  });
  if (r.code !== 0) {
    throw new LocalToolError(`om --list falhou: ${r.stderr.slice(0, 200)}`, r);
  }
  const parsed = JSON.parse(r.stdout) as { tools?: string[] };
  return parsed.tools ?? [];
}

/**
 * Executa uma ferramenta OpenMontage num processo separado.
 * Falha aberta: lança LocalToolError; o chamador decide se continua sem a fase.
 */
export async function runOmTool(
  name: string,
  inputs: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<OmResult> {
  const python = await resolvePython();
  const r = await runTool(
    python,
    [path.join(TOOLS_DIR, 'run_tool.py'), name, JSON.stringify(inputs)],
    { cwd: TOOLS_DIR, timeoutMs: opts.timeoutMs ?? 600_000, env: { ...process.env, OM_ROOT: omRoot() } },
  );
  let parsed: OmResult;
  try {
    parsed = JSON.parse(r.stdout.trim().split('\n').at(-1) ?? '') as OmResult;
  } catch {
    throw new LocalToolError(`om/${name}: saída inválida: ${r.stderr.slice(0, 200)}`, r);
  }
  if (!parsed.success) {
    throw new LocalToolError(`om/${name}: ${parsed.error ?? 'falhou'}`, r);
  }
  return parsed;
}
