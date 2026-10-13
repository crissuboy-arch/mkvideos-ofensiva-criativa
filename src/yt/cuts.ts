// src/yt/cuts.ts — lista de decisão de edição via deadair.py (youtube-agent-skill, MIT).
//
// O deadair.py lê um SRT/VTT/whisper-json e devolve os cortes (JSON):
//   DEAD (silêncios), FILLER (muletas), REPEAT (frase recomeçada).
// Chamado como subprocesso via runTool. Nada é importado.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool, resolvePython, LocalToolError } from '../localtools/exec.js';

const YT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'tools', 'yt',
);

export type CutKind = 'DEAD' | 'FILLER' | 'REPEAT';

export interface Cut {
  kind: CutKind;
  start: number;   // segundos
  end: number;     // segundos
  why: string;
}

export interface EditDecisionList {
  source: string;
  duration: number;
  cuts: Cut[];
  removed: number;  // segundos removidos
  out: number;      // duração final estimada
}

/**
 * Gera a lista de cortes a partir de um ficheiro de transcrição.
 * O SRT pode vir do `mkivideos legendas transcrever` (whisper local).
 */
export async function editDecisionList(
  srtPath: string,
  opts: { floor?: number; ytDir?: string } = {},
): Promise<EditDecisionList> {
  const ytDir = opts.ytDir ?? YT_DIR;
  const python = await resolvePython();
  const args = [path.join(ytDir, 'deadair.py'), srtPath, '--json'];
  if (opts.floor !== undefined) args.push('--floor', String(opts.floor));
  const r = await runTool(python, args, { cwd: ytDir, timeoutMs: 60_000 });
  if (r.code !== 0) {
    throw new LocalToolError(`deadair falhou: ${(r.stderr || r.stdout).slice(0, 200)}`, r);
  }
  const parsed = JSON.parse(r.stdout) as EditDecisionList;
  if (!Array.isArray(parsed.cuts)) {
    throw new LocalToolError('deadair devolveu JSON inesperado', r);
  }
  return parsed;
}
