// Ciclo de vida do processo do motor content2video.
//
// O motor é um servidor Node local (modules/content2video/app/server.mjs). O
// MKVideos sobe **um** processo sob demanda, em loopback, sem a UI empacotada,
// e o encerra no shutdown. Alternativa: apontar MKIVIDEOS_C2V_URL para uma
// instância já rodando (então nada é spawnado).

import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';

import { EngineNotAvailableError } from '../types.js';
import { loadC2VConfig, moduleRoot, type C2VConfig } from './config.js';

export interface RunningEngine {
  baseUrl: string;
  /** null quando usando instância externa. */
  child: ChildProcess | null;
  previewHost: string;
}

let current: RunningEngine | null = null;
let starting: Promise<RunningEngine> | null = null;
let shutdownHooked = false;

function freePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('não obtive porta livre'))));
    });
  });
}

async function waitHealthy(baseUrl: string, timeoutMs: number, child: ChildProcess | null): Promise<void> {
  const started = Date.now();
  let lastErr = 'sem resposta';
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) {
      throw new EngineNotAvailableError(`o motor content2video encerrou na subida (código ${child.exitCode}).`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return;
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new EngineNotAvailableError(`o motor content2video não respondeu em ${Math.round(timeoutMs / 1000)}s (${lastErr}).`);
}

function hookShutdown(): void {
  if (shutdownHooked) return;
  shutdownHooked = true;
  const stop = (): void => { void stopEngineProcess(); };
  process.once('exit', stop);
  process.once('SIGINT', () => { stop(); process.exit(0); });
  process.once('SIGTERM', () => { stop(); process.exit(0); });
}

async function boot(cfg: C2VConfig): Promise<RunningEngine> {
  if (cfg.externalUrl) {
    const ext: RunningEngine = { baseUrl: cfg.externalUrl, child: null, previewHost: cfg.previewHost };
    await waitHealthy(ext.baseUrl, 5_000, null).catch((e) => {
      throw new EngineNotAvailableError(
        `MKIVIDEOS_C2V_URL=${cfg.externalUrl} não respondeu em /healthz (${(e as Error).message}).`,
      );
    });
    return ext;
  }

  const root = moduleRoot();
  const serverEntry = path.join(root, 'app', 'server.mjs');
  if (!existsSync(serverEntry)) {
    throw new EngineNotAvailableError(
      `motor content2video ausente: ${serverEntry} não existe. Restaure modules/content2video/ (ver modules/content2video/ORIGEM.md).`,
    );
  }

  const port = cfg.port || (await freePort(cfg.host));
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      APP_HOST: cfg.host,
      APP_PORT: String(port),
      PREVIEW_HOST: cfg.previewHost,
      // UI empacotada permanece desativada (patch local do módulo).
      C2V_ALLOW_BUNDLED_UI: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (b) => log('c2v', b));
  child.stderr?.on('data', (b) => log('c2v!', b));
  child.once('exit', (code) => {
    if (current?.child === child) current = null;
    if (code) console.warn(`[mkivideos] motor content2video saiu (código ${code}).`);
  });

  const running: RunningEngine = { baseUrl: `http://${cfg.host}:${port}`, child, previewHost: cfg.previewHost };
  await waitHealthy(running.baseUrl, cfg.bootTimeoutMs, child);
  hookShutdown();
  return running;
}

function log(tag: string, buf: Buffer): void {
  const line = buf.toString().replace(/\s+$/, '');
  if (line) console.log(`[${tag}] ${line.slice(0, 500)}`);
}

/** Garante o motor no ar e devolve a base URL. Idempotente/concorrência-segura. */
export async function ensureEngineProcess(): Promise<RunningEngine> {
  if (current) return current;
  if (starting) return starting;
  const cfg = loadC2VConfig();
  starting = boot(cfg)
    .then((r) => { current = r; return r; })
    .finally(() => { starting = null; });
  return starting;
}

/** Encerra o processo gerenciado (no-op para instância externa). */
export async function stopEngineProcess(): Promise<void> {
  const running = current;
  current = null;
  if (!running?.child) return;
  try {
    running.child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    if (running.child.exitCode === null) running.child.kill('SIGKILL');
  } catch { /* já encerrado */ }
}

/** Base URL se o motor já estiver no ar (sem subir). */
export function currentBaseUrl(): string | null {
  return current?.baseUrl ?? null;
}
