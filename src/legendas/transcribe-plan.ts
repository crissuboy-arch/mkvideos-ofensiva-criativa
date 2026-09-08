// Plano de transcrição da aba "Legendar": antes de rodar qualquer coisa, a UI
// mostra qual provedor será usado, se é local/grátis ou pago, a duração do
// vídeo e o custo estimado (quando dá para calcular). Nenhum serviço pago roda
// aqui — este módulo só *descreve* as opções; o gate de custo continua sendo o
// de src/cost/gate.ts, aplicado no OtimizevideoService.transcrever.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { ffprobeDuration } from '../audio/probe.js';
import { runTool, resolvePython } from '../localtools/exec.js';
import { moduleRoot as otimizevideoRoot } from '../otimizevideo/config.js';

/**
 * Estimativa do PRÓPRIO módulo otimizevideo (otv.py: "transcrição Groq não
 * reporta custo: ~US$0,04/h"). Não é um preço inventado aqui — é a referência
 * que já existe no código do módulo. A API da Groq não devolve o custo real.
 */
export const GROQ_USD_PER_HOUR = 0.04;

export type TranscribeProviderId = 'whisper_local' | 'whisperx' | 'groq';

export interface TranscribeProviderInfo {
  id: TranscribeProviderId;
  label: string;
  kind: 'local' | 'paid';
  /** true quando dá para usar agora (dependências presentes / chave configurada). */
  available: boolean;
  /** o que falta instalar/configurar quando `available` é false. */
  missing?: string;
  /** custo estimado em US$; 0 = local/grátis; null = "estimativa indisponível". */
  estimatedUsd: number | null;
  note: string;
}

export interface TranscribePlan {
  durationSeconds: number | null;
  durationLabel: string;
  providers: TranscribeProviderInfo[];
  recommendedProviderId: TranscribeProviderId;
  /** há ao menos um provedor local pronto para uso. */
  localReady: boolean;
  /** dica de instalação quando não há provedor local pronto. */
  localHint: string;
}

export interface PlanDeps {
  probeDuration?: (file: string) => Promise<number>;
  /** checa se um módulo Python está instalado (sem importá-lo). */
  probeModule?: (mod: string) => Promise<boolean>;
  otvPresent?: () => boolean;
}

const moduleCache = new Map<string, boolean>();

/** Checa `importlib.util.find_spec(mod)` — não executa o pacote (rápido). */
async function pythonHasModule(env: NodeJS.ProcessEnv, mod: string): Promise<boolean> {
  if (moduleCache.has(mod)) return moduleCache.get(mod)!;
  let ok = false;
  try {
    const py = await resolvePython(env);
    const r = await runTool(
      py,
      ['-c', `import importlib.util,sys; sys.exit(0 if importlib.util.find_spec(${JSON.stringify(mod)}) else 1)`],
      { cwd: process.cwd(), timeoutMs: 10_000 },
    );
    ok = r.code === 0;
  } catch {
    ok = false;
  }
  moduleCache.set(mod, ok);
  return ok;
}

/** Só para testes. */
export function _resetTranscribeProbeCache(): void {
  moduleCache.clear();
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

const round6 = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;

/** Rótulo de custo pronto para exibir (UI/CLI) — nunca chama serviço nenhum. */
export function costLabel(p: TranscribeProviderInfo): string {
  if (p.kind === 'local') return 'grátis';
  if (p.estimatedUsd == null) return 'estimativa indisponível';
  if (p.estimatedUsd >= 0.0001) return `~US$ ${p.estimatedUsd.toFixed(4)}`;
  return '< US$ 0,0001';
}

export async function buildTranscribePlan(
  videoPath: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: PlanDeps = {},
): Promise<TranscribePlan> {
  const otvPresent = (deps.otvPresent ?? (() => existsSync(path.join(otimizevideoRoot(), 'otv.py'))))();
  const probeDuration = deps.probeDuration ?? ffprobeDuration;
  const probeModule = deps.probeModule ?? ((m: string) => pythonHasModule(env, m));

  let durationSeconds: number | null = null;
  try {
    const d = await probeDuration(videoPath);
    if (Number.isFinite(d) && d > 0) durationSeconds = d;
  } catch {
    durationSeconds = null; // ffprobe ausente ou arquivo ilegível — custo fica "indisponível"
  }

  const [hasWhisper, hasWhisperx] = otvPresent
    ? await Promise.all([probeModule('whisper'), probeModule('whisperx')])
    : [false, false];

  const groqCost = durationSeconds != null ? round6((durationSeconds / 3600) * GROQ_USD_PER_HOUR) : null;
  const semModulo = 'módulo otimizevideo ausente (ver modules/otimizevideo/ORIGEM.md)';

  const providers: TranscribeProviderInfo[] = [
    {
      id: 'whisper_local',
      label: 'Whisper local (turbo)',
      kind: 'local',
      available: otvPresent && hasWhisper,
      missing: !otvPresent ? semModulo : hasWhisper ? undefined
        : 'instale: pip install -U openai-whisper (requer Python 3 e ffmpeg no PATH)',
      estimatedUsd: 0,
      note: 'Roda 100% no seu computador, sem custo. Mais lento que a nuvem, sobretudo sem GPU.',
    },
    {
      id: 'whisperx',
      label: 'WhisperX local',
      kind: 'local',
      available: otvPresent && hasWhisperx,
      missing: !otvPresent ? semModulo : hasWhisperx ? undefined
        : 'instale: pip install -U whisperx torch',
      estimatedUsd: 0,
      note: 'Local, sem custo; usa GPU quando disponível.',
    },
    {
      id: 'groq',
      label: 'Groq (whisper-large-v3-turbo)',
      kind: 'paid',
      available: otvPresent && Boolean(env.GROQ_API_KEY),
      missing: !otvPresent ? semModulo : env.GROQ_API_KEY ? undefined
        : 'defina GROQ_API_KEY no .env',
      estimatedUsd: groqCost,
      note: groqCost != null
        ? 'A Groq não informa o custo real por chamada; estimativa do módulo: ~US$0,04 por hora de áudio.'
        : 'A Groq não informa o custo real e, sem a duração do vídeo, não dá para estimar — estimativa indisponível.',
    },
  ];

  const firstLocal = providers.find((p) => p.kind === 'local' && p.available);
  const localReady = Boolean(firstLocal);

  return {
    durationSeconds,
    durationLabel: durationSeconds != null ? formatDuration(durationSeconds) : 'desconhecida',
    providers,
    recommendedProviderId: firstLocal?.id ?? 'groq',
    localReady,
    localHint: localReady ? ''
      : 'Para ativar a transcrição grátis: pip install -U openai-whisper (precisa de Python 3 e ffmpeg no PATH).',
  };
}
