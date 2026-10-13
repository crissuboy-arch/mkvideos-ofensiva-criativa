// src/yt/hooks.ts — pontua ganchos com o hookscore.py (youtube-agent-skill, MIT).
//
// Chamado como subprocesso via runTool (mesmo padrão do ffmpeg).
// Nada é importado: o script corre isolado e devolve texto parseado aqui.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool, resolvePython, LocalToolError } from '../localtools/exec.js';

const YT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'tools', 'yt',
);

export interface ScoredHook {
  hook: string;
  score: number;      // 0–100
  verdict: string;    // STRONG | OK | WEAK | ...
  weakest: string;    // dimensão mais fraca + sugestão
}

const VERDICT_RE = /VERDICT\s+(\d+)\s+([A-Z]+)/;
const WEAKEST_RE = /weakest\s+(.+)/;

/** Pontua um gancho (0–100). Lança LocalToolError se o script falhar. */
export async function scoreHook(hook: string, ytDir: string = YT_DIR): Promise<ScoredHook> {
  const python = await resolvePython();
  const r = await runTool(python, [path.join(ytDir, 'hookscore.py'), '--hook', hook], {
    cwd: ytDir,
    timeoutMs: 30_000,
  });
  if (r.code !== 0) {
    throw new LocalToolError(`hookscore falhou para o gancho: ${r.stderr.slice(0, 200)}`, r);
  }
  const vm = r.stdout.match(VERDICT_RE);
  const wm = r.stdout.match(WEAKEST_RE);
  return {
    hook,
    score: vm ? parseInt(vm[1], 10) : 0,
    verdict: vm ? vm[2] : 'UNKNOWN',
    weakest: wm ? wm[1].trim() : '',
  };
}

/** Pontua vários ganchos e devolve por ordem decrescente de nota. */
export async function scoreHooks(hooks: string[], ytDir: string = YT_DIR): Promise<ScoredHook[]> {
  const scored = await Promise.all(hooks.map((h) => scoreHook(h, ytDir)));
  return scored.sort((a, b) => b.score - a.score);
}

/** O melhor gancho da lista (ou null se vazia). */
export async function bestHook(hooks: string[], ytDir: string = YT_DIR): Promise<ScoredHook | null> {
  if (!hooks.length) return null;
  const [best] = await scoreHooks(hooks, ytDir);
  return best;
}
