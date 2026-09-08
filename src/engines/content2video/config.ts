// Configuração do motor content2video (vendorizado em modules/content2video).

import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do módulo vendorizado (…/modules/content2video). */
export function moduleRoot(): string {
  // {src,dist}/engines/content2video/config.{ts,js} → subir 3 = raiz do repo
  const candidates = [
    path.resolve(__dir, '..', '..', '..', 'modules', 'content2video'),
    path.resolve(__dir, '..', '..', '..', '..', 'modules', 'content2video'),
    path.resolve(process.cwd(), 'modules', 'content2video'),
  ];
  return candidates.find((c) => existsSync(path.join(c, 'app', 'server.mjs')))
    ?? candidates[candidates.length - 1];
}

export interface C2VConfig {
  /** Se definido, o MKVideos NÃO sobe processo — usa este motor externo. */
  externalUrl: string | null;
  /** Host de escuta do processo gerenciado (sempre loopback). */
  host: string;
  /** Porta do processo gerenciado (0 = escolhe automática). */
  port: number;
  /** Host de preview do HyperFrames Studio (aberto sob demanda). */
  previewHost: string;
  /** Timeout de subida do processo (ms). */
  bootTimeoutMs: number;
  /** Diretório de saída dos projetos (default: modules/content2video/output/content2video). */
  outputDir: string | null;
}

export function loadC2VConfig(): C2VConfig {
  const num = (v: string | undefined, d: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    externalUrl: process.env.MKIVIDEOS_C2V_URL?.replace(/\/+$/, '') || null,
    host: process.env.MKIVIDEOS_C2V_HOST || '127.0.0.1',
    port: num(process.env.MKIVIDEOS_C2V_PORT, 0),
    previewHost: process.env.MKIVIDEOS_C2V_PREVIEW_HOST || '127.0.0.1',
    bootTimeoutMs: num(process.env.MKIVIDEOS_C2V_BOOT_TIMEOUT_MS, 20_000),
    outputDir: process.env.MKIVIDEOS_C2V_OUTPUT_DIR || null,
  };
}
