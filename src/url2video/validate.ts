// Validação/normalização pura da entrada da URL → Vídeo (testável sem motor).

import { normalizeAspect, normalizePace, normalizeStyle } from './config.js';
import { Url2VideoValidationError, type Url2VideoDefaults, type Url2VideoRequest, type Url2VideoRequestRaw } from './types.js';

const MAX_OBJECTIVE = 4000;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (/^(1|true|sim|on|yes)$/i.test(v.trim())) return true;
    if (/^(0|false|nao|não|off|no)$/i.test(v.trim())) return false;
  }
  return fallback;
}

/** Valida a URL: precisa ser http(s) absoluta. Lança Url2VideoValidationError. */
export function validateUrl(value: unknown): string {
  const raw = str(value);
  if (!raw) throw new Url2VideoValidationError('Informe uma URL.');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Url2VideoValidationError('A URL precisa ser completa, começando com http:// ou https://.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Url2VideoValidationError('Somente URLs http:// e https:// são aceitas.');
  }
  return parsed.href;
}

export function normalizeRequest(raw: Url2VideoRequestRaw, defaults: Url2VideoDefaults): Url2VideoRequest {
  const url = validateUrl(raw.url);

  const objective = str(raw.objetivo) ?? str(raw.objective);
  if (objective && objective.length > MAX_OBJECTIVE) {
    throw new Url2VideoValidationError(`O objetivo deve ter no máximo ${MAX_OBJECTIVE} caracteres.`);
  }

  return {
    url,
    objective,
    aspectRatio: normalizeAspect(str(raw.formato) ?? str(raw.aspectRatio), defaults.aspectRatio),
    conversationStyle: normalizeStyle(str(raw.estilo) ?? str(raw.conversationStyle), defaults.conversationStyle),
    speechPace: normalizePace(str(raw.ritmo) ?? str(raw.speechPace), defaults.speechPace),
    visualPresetId: str(raw.preset) ?? str(raw.visualPresetId) ?? defaults.visualPresetId,
    includeCta: bool(raw.cta ?? raw.includeCta, defaults.includeCta),
  };
}

export function normalizeTransform(raw: { instructions?: unknown; instrucoes?: unknown; formato?: unknown; aspectRatio?: unknown; cta?: unknown; includeCta?: unknown }, defaults: Url2VideoDefaults): {
  instructions: string; aspectRatio: Url2VideoRequest['aspectRatio']; includeCta: boolean;
} {
  const instructions = str(raw.instructions) ?? str(raw.instrucoes);
  if (!instructions || instructions.length < 3) {
    throw new Url2VideoValidationError('Descreva o que deseja manter, retirar ou alterar (mín. 3 caracteres).');
  }
  if (instructions.length > 6000) {
    throw new Url2VideoValidationError('A instrução deve ter no máximo 6.000 caracteres.');
  }
  return {
    instructions,
    aspectRatio: normalizeAspect(str(raw.formato) ?? str(raw.aspectRatio), defaults.aspectRatio),
    includeCta: bool(raw.cta ?? raw.includeCta, defaults.includeCta),
  };
}
