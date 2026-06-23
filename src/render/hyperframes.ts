// Wrappers do HyperFrames CLI (init/lint/inspect/render). Tudo local.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const HF = 'hyperframes@0.6.80';
const isWin = process.platform === 'win32';

export interface RunOpts {
  maxBuffer?: number;
  /** Mata o processo e rejeita se passar do tempo (evita render pendurado pra sempre). */
  timeoutMs?: number;
}

/** Roda `hyperframes <cmd…>` em cwd e devolve stdout+stderr. */
export async function runHyperframes(cmd: string[], cwd: string, opts: RunOpts = {}): Promise<string> {
  const { stdout, stderr } = await run(NPX, [HF, ...cmd], {
    cwd,
    maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
    shell: isWin,
    timeout: opts.timeoutMs ?? 0,   // 0 = sem timeout (init/lint/inspect)
    killSignal: 'SIGKILL',
  });
  return stdout + stderr;
}

export async function hfInit(cwd: string): Promise<string> {
  return runHyperframes(['init', '.', '--example', 'blank', '--non-interactive'], cwd);
}

export async function hfLint(cwd: string): Promise<string> {
  return runHyperframes(['lint'], cwd);
}

export async function hfInspect(cwd: string, samples = 8): Promise<string> {
  return runHyperframes(['inspect', '--samples', String(samples)], cwd);
}

/**
 * Render para `output`. GPU é opt-in (não ajuda este pipeline e já causou hang em
 * máquina sem GPU dedicada). `timeoutMs` limita o tempo para o render nunca pendurar.
 *
 * Render leve via env (sem env = comportamento atual, --quality high):
 *   MKIVIDEOS_RENDER_QUALITY=draft|standard|high  (default: high)
 *   MKIVIDEOS_RENDER_FPS=15                        (default: HyperFrames = 30)
 *   MKIVIDEOS_RENDER_WORKERS=1                     (default: auto)
 *   MKIVIDEOS_LOW_MEMORY=1                         (default: off) → --low-memory-mode
 */
export async function hfRender(cwd: string, output: string, opts: { gpu?: boolean; timeoutMs?: number } = {}): Promise<string> {
  const quality = process.env.MKIVIDEOS_RENDER_QUALITY || 'high';
  const fps = process.env.MKIVIDEOS_RENDER_FPS;
  const workers = process.env.MKIVIDEOS_RENDER_WORKERS;
  const flags = ['render', '--quality', quality];
  if (fps) flags.push('--fps', fps);
  if (workers) flags.push('-w', workers);
  if (process.env.MKIVIDEOS_LOW_MEMORY === '1') flags.push('--low-memory-mode');
  if (opts.gpu) flags.push('--gpu', '--browser-gpu');
  flags.push('--output', output);
  return runHyperframes(flags, cwd, { timeoutMs: opts.timeoutMs });
}
