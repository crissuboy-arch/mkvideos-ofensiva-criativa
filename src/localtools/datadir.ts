// Raiz comum de dados locais dos módulos CLI (musicavideo/otimizevideo/legendas).
// Separado de `renders/` (saída do `gerar` offline) e de
// `modules/content2video/output/` (convenção própria do motor content2video).

import path from 'node:path';
import { mkdirSync } from 'node:fs';

export function dataRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.MKIVIDEOS_DATA_DIR || path.resolve(process.cwd(), '.mkvideos-data'));
}

export function moduleDataDir(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const dir = path.join(dataRoot(env), name);
  mkdirSync(dir, { recursive: true });
  return dir;
}
