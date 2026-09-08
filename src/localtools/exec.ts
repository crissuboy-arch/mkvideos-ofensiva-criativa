// Wrapper genérico para rodar ferramentas locais (Python/CLI) como as usadas por
// musicavideo e otimizevideo. Diferente do motor content2video (servidor HTTP em
// loopback), esses módulos são CLIs one-shot: cada comando é um processo curto
// que lê/escreve JSON em disco. Este helper só padroniza spawn + captura + erro.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface RunToolResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class LocalToolError extends Error {
  constructor(message: string, readonly result: Partial<RunToolResult>) {
    super(message);
    this.name = 'LocalToolError';
  }
}

export interface RunToolOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

/** Roda `cmd args…` e devolve stdout/stderr mesmo em erro (não lança em exit≠0). */
export async function runTool(cmd: string, args: string[], opts: RunToolOptions): Promise<RunToolResult> {
  try {
    const { stdout, stderr } = await run(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      timeout: opts.timeoutMs ?? 0,
      maxBuffer: opts.maxBuffer ?? 20 * 1024 * 1024,
      windowsHide: true,
    });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { code?: number | string; stdout?: string; stderr?: string };
    if (err.code === 'ENOENT') {
      throw new LocalToolError(`comando "${cmd}" não encontrado no PATH.`, {});
    }
    const code = typeof err.code === 'number' ? err.code : 1;
    return { code, stdout: err.stdout ?? '', stderr: err.stderr ?? err.message };
  }
}

let cachedPython: string | null = null;

/** Resolve o executável Python disponível (python3 no Linux/macOS; python/py no Windows). */
export async function resolvePython(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  if (env.MKIVIDEOS_PYTHON) return env.MKIVIDEOS_PYTHON;
  if (cachedPython) return cachedPython;
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const r = await runTool(cmd, ['--version'], { cwd: process.cwd() }).catch(() => null);
    if (r && r.code === 0) { cachedPython = cmd; return cmd; }
  }
  throw new LocalToolError(
    'Python não encontrado no PATH (tentei: ' + candidates.join(', ') + '). Instale Python 3.10+.',
    {},
  );
}

/** Só para testes. */
export function _resetPythonCache(): void {
  cachedPython = null;
}
