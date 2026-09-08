import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { moduleDataDir } from '../localtools/datadir.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do módulo vendorizado (…/modules/musicavideo). */
export function moduleRoot(): string {
  const candidates = [
    path.resolve(__dir, '..', '..', 'modules', 'musicavideo'),
    path.resolve(process.cwd(), 'modules', 'musicavideo'),
  ];
  return candidates.find((c) => existsSync(path.join(c, 'src', 'main.py'))) ?? candidates[0];
}

/** Pasta de saída dos projetos (MUSICAVIDEOS_OUT), dentro dos dados do MKVideos. */
export function outDir(env: NodeJS.ProcessEnv = process.env): string {
  return moduleDataDir('musicavideo', env);
}

/** As chaves que o musicavideo pode precisar, repassadas via env do processo filho. */
export const MUSICAVIDEO_ENV_KEYS = ['KIE_API_KEY', 'AGNES_API_KEY', 'FAL_KEY'] as const;

/** Providers que consomem crédito/dinheiro — exigem `--autorizo-pago` no próprio CLI. */
export const MOTORES_PAGOS = ['kie', 'kling', 'fal'] as const;

export function motorEhPago(motor: string): boolean {
  const prefixo = motor.split(':')[0];
  return (MOTORES_PAGOS as readonly string[]).includes(prefixo);
}
