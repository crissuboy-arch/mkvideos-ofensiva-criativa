// Defaults da URL → Vídeo, configuráveis por ambiente.

import { ASPECT_RATIOS, CONVERSATION_STYLES, SPEECH_PACES, type AspectRatio, type ConversationStyle, type EngineId, type SpeechPace } from '../engines/types.js';
import type { Url2VideoDefaults } from './types.js';

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = (value ?? '').trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Aceita '9:16'/'16:9' e 'vertical'/'horizontal'. */
export function normalizeAspect(value: string | undefined, fallback: AspectRatio): AspectRatio {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '9:16' || v === 'vertical' || v === '9x16') return '9:16';
  if (v === '16:9' || v === 'horizontal' || v === '16x9') return '16:9';
  return fallback;
}

/** Aceita rótulos PT curtos além dos ids do motor. */
export function normalizeStyle(value: string | undefined, fallback: ConversationStyle): ConversationStyle {
  const v = (value ?? '').trim().toLowerCase();
  const map: Record<string, ConversationStyle> = {
    popular: 'popular', simples: 'popular', 'popular e simples': 'popular',
    natural: 'natural', conversa: 'natural', 'conversa natural': 'natural',
    technical: 'technical', tecnico: 'technical', 'técnico': 'technical', 'tecnico e detalhado': 'technical',
  };
  return map[v] ?? pick(v, CONVERSATION_STYLES, fallback);
}

export function normalizePace(value: string | undefined, fallback: SpeechPace): SpeechPace {
  const v = (value ?? '').trim().toLowerCase();
  const map: Record<string, SpeechPace> = {
    calm: 'calm', calma: 'calm', lenta: 'calm',
    natural: 'natural', normal: 'natural',
    fast: 'fast', rapida: 'fast', 'rápida': 'fast', rapido: 'fast',
  };
  return map[v] ?? pick(v, SPEECH_PACES, fallback);
}

export function loadDefaults(env: NodeJS.ProcessEnv = process.env): Url2VideoDefaults {
  return {
    engine: (env.MKIVIDEOS_ENGINE?.trim() || 'content2video') as EngineId,
    aspectRatio: normalizeAspect(env.MKIVIDEOS_URL2VIDEO_FORMAT, '9:16'),
    conversationStyle: normalizeStyle(env.MKIVIDEOS_URL2VIDEO_STYLE, 'popular'),
    speechPace: normalizePace(env.MKIVIDEOS_URL2VIDEO_PACE, 'natural'),
    includeCta: env.MKIVIDEOS_URL2VIDEO_CTA
      ? !/^(0|false|nao|não|off)$/i.test(env.MKIVIDEOS_URL2VIDEO_CTA.trim())
      : true,
    visualPresetId: env.MKIVIDEOS_URL2VIDEO_PRESET?.trim() || undefined,
  };
}

export { ASPECT_RATIOS, CONVERSATION_STYLES, SPEECH_PACES };
