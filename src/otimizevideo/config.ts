import path from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { moduleDataDir } from '../localtools/datadir.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));

export function moduleRoot(): string {
  const candidates = [
    path.resolve(__dir, '..', '..', 'modules', 'otimizevideo'),
    path.resolve(process.cwd(), 'modules', 'otimizevideo'),
  ];
  return candidates.find((c) => existsSync(path.join(c, 'otv.py'))) ?? candidates[0];
}

export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return moduleDataDir('otimizevideo', env);
}
export function trabalhoDir(env: NodeJS.ProcessEnv = process.env): string {
  const d = path.join(dataDir(env), 'trabalho');
  mkdirSync(d, { recursive: true });
  return d;
}
export function saidaDir(env: NodeJS.ProcessEnv = process.env): string {
  const d = path.join(dataDir(env), 'saida');
  mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Gera (uma vez) um config.yaml derivado do vendorizado, com `saida`/`trabalho`
 * apontando para as pastas de dados do MKVideos (caminhos absolutos, sem `~`).
 */
export function ensureConfigYaml(env: NodeJS.ProcessEnv = process.env): string {
  const dest = path.join(dataDir(env), 'mkvideos.config.yaml');
  const base = path.join(moduleRoot(), 'config.yaml');
  const original = existsSync(base) ? readFileSync(base, 'utf-8') : '';
  const yamlPath = (p: string): string => p.replace(/\\/g, '/');
  const body = original
    .replace(/^saida:.*$/m, `saida: ${yamlPath(saidaDir(env))}`)
    .replace(/^trabalho:.*$/m, `trabalho: ${yamlPath(trabalhoDir(env))}`)
    .replace(/^cta:.*$/m, `cta: ''`); // não assumir um CTA de terceiros
  writeFileSync(dest, body.includes('saida:') ? body : `${body}\nsaida: ${yamlPath(saidaDir(env))}\ntrabalho: ${yamlPath(trabalhoDir(env))}\n`);
  return dest;
}

/** Chaves repassadas ao processo filho (o patch de keys.py lê de os.environ). */
export const OTV_ENV_KEYS = [
  'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'FAL_KEY',
] as const;

/** Providers gratuitos/locais por slot — não disparam o gate de custo. */
export const PROVIDERS_GRATIS: Record<string, string[]> = {
  // 'claude_cli' sai da assinatura Claude (sem cobrança em US$ por chamada de API).
  transcricao: ['whisper_local', 'whisperx'],
  visual: ['local', 'claude_cli'],
  pontuacao: ['ollama', 'claude_cli'],
  tts: ['inemavox'],
};

export function faseProviderEhPago(slot: keyof typeof PROVIDERS_GRATIS, provider: string): boolean {
  return !(PROVIDERS_GRATIS[slot] ?? []).includes(provider);
}
