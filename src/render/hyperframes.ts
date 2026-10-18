// Wrappers do HyperFrames CLI (init/lint/inspect/render). Tudo local.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
/**
 * Versão do pacote npm `hyperframes` (heygen-com, Apache-2.0).
 * Default 0.6.80 = versão provada neste pipeline. Para testar versões novas
 * (ex.: 0.8.x), defina HYPERFRAMES_VERSION no .env — sem trocar o default
 * sem um render de validação. npm latest em 2026-10-18: 0.8.172.
 */
export const HYPERFRAMES_PKG = `hyperframes@${process.env.HYPERFRAMES_VERSION || '0.6.80'}`;
const HF = HYPERFRAMES_PKG;
const isWin = process.platform === 'win32';

export interface RunOpts {
  maxBuffer?: number;
  /** Mata o processo e rejeita se passar do tempo (evita render pendurado pra sempre). */
  timeoutMs?: number;
  /**
   * Sonda rápida: `npx --no-install` falha de imediato se o pacote não estiver
   * em cache, em vez de baixar. Ideal para health checks (não para renders).
   */
  noInstall?: boolean;
}

/** Roda `hyperframes <cmd…>` em cwd e devolve stdout+stderr. */
export async function runHyperframes(cmd: string[], cwd: string, opts: RunOpts = {}): Promise<string> {
  const pkg = opts.noInstall ? ['--no-install', HF] : [HF];
  const { stdout, stderr } = await run(NPX, [...pkg, ...cmd], {
    cwd,
    maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
    shell: isWin,
    timeout: opts.timeoutMs ?? 0,   // 0 = sem timeout (init/lint/inspect)
    killSignal: 'SIGKILL',
  });
  return stdout + stderr;
}

/** Devolve a versão instalada/resolvida (`hyperframes --version`).
 * Sonda rápida: não baixa o pacote; falha se não estiver em cache. */
export async function hfVersion(cwd: string): Promise<string> {
  const out = await runHyperframes(['--version'], cwd, { timeoutMs: 30_000, noInstall: true });
  return out.trim();
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
