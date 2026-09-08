// Camada de motores ("engines") de vídeo do MKVideos.
//
// Um *engine* é um motor de produção de vídeo tratado como plugin: recebe uma
// entrada de alto nível (hoje: uma URL) e devolve um projeto editável + um MP4.
// O MKVideos nunca embute a UI de um engine — só consome esta interface e mostra
// tudo pelo painel/CLI com a identidade visual do MKVideos.
//
// Motor atual: `content2video` (URL → Vídeo, via Codex + HyperFrames + Edge TTS).
// Arquitetura preparada para outros motores/provedores (Kling, Veo, Runway,
// HeyGen, Sora, geração de imagem, avatar, mídia local) — ver src/engines/providers.

export type EngineId = 'content2video';

/** Proporção de tela pedida pelo usuário. */
export type AspectRatio = '9:16' | '16:9';

/** Jeito de falar do roteiro (mapeia para os presets do motor). */
export type ConversationStyle = 'popular' | 'natural' | 'technical';

/** Ritmo da narração. */
export type SpeechPace = 'calm' | 'natural' | 'fast';

export const ASPECT_RATIOS: AspectRatio[] = ['9:16', '16:9'];
export const CONVERSATION_STYLES: ConversationStyle[] = ['popular', 'natural', 'technical'];
export const SPEECH_PACES: SpeechPace[] = ['calm', 'natural', 'fast'];

/** `9:16` ↔ formato interno do MKVideos (`vertical`/`horizontal`). */
export function aspectToFormat(a: AspectRatio): 'vertical' | 'horizontal' {
  return a === '16:9' ? 'horizontal' : 'vertical';
}
export function formatToAspect(f: 'vertical' | 'horizontal'): AspectRatio {
  return f === 'horizontal' ? '16:9' : '9:16';
}

/** Entrada da funcionalidade URL → Vídeo. */
export interface UrlToVideoInput {
  url: string;
  /** Objetivo editorial opcional (público, recorte, mensagem). */
  objective?: string;
  aspectRatio: AspectRatio;
  conversationStyle: ConversationStyle;
  speechPace: SpeechPace;
  /** Preset visual do motor (id). Ausente → default do motor. */
  visualPresetId?: string;
  /** Anexar CTA da marca ao final do MP4. */
  includeCta: boolean;
}

/** Instrução de edição/duplicação de um projeto existente. */
export interface ProjectTransformInput {
  instructions: string;
  aspectRatio?: AspectRatio;
  includeCta?: boolean;
}

export type EngineJobType = 'generation' | 'duplicate' | 'edit' | 'render';
export type EngineJobStatus =
  | 'queued' | 'running' | 'awaiting_approval' | 'cancelling'
  | 'cancelled' | 'completed' | 'failed';

export interface EngineJobPhaseTiming {
  phase: string;
  phaseIndex: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

/** Job normalizado exposto pelo motor (subconjunto estável do payload do upstream). */
export interface EngineJob {
  id: string;
  type: EngineJobType;
  project: string;
  status: EngineJobStatus;
  stage: string;
  phaseIndex: number;
  phases: string[];
  phaseTimings: EngineJobPhaseTiming[];
  aspectRatio: AspectRatio;
  includeCta: boolean;
  conversationStyleLabel?: string;
  speechPaceLabel?: string;
  visualPresetName?: string | null;
  /** URL (relativa ao motor) da imagem da cena-piloto, quando aguardando aprovação. */
  visualGatePreviewUrl?: string | null;
  cancelable: boolean;
  retryable: boolean;
  resumeAvailable: boolean;
  skippedPhases: number[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
  totalDurationMs: number;
  logs: string[];
}

export interface EngineRender {
  name: string;
  size: number;
  modifiedAt: string;
  /** URL relativa ao motor (proxiar por /api/url2video/media/...). */
  url: string;
}

/** Projeto normalizado exposto pelo motor. */
export interface EngineProject {
  slug: string;
  name: string;
  modifiedAt: string;
  aspectRatio: AspectRatio;
  includeCta: boolean;
  conversationStyleLabel: string;
  speechPaceLabel: string;
  visualPresetName: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  renders: EngineRender[];
}

export interface EngineVisualPreset {
  id: string;
  name: string;
  description: string;
}

export interface EngineHealth {
  id: EngineId;
  available: boolean;
  /** Motor conectado e pronto para produzir (auth de IA ok). */
  ready: boolean;
  message: string;
  version?: string;
  /** Checagens individuais (node, ffmpeg, provider de IA, …). */
  checks: { name: string; ok: boolean; detail: string; required: boolean }[];
}

export interface EngineConfigInfo {
  language: string;
  voiceId: string;
  aspectRatio: AspectRatio;
  resolution: string;
  targetDuration: number;
  minimumQuality: number;
  defaultVisualPresetId: string;
  visualPresets: EngineVisualPreset[];
  conversationStyles: { value: string; label: string; description: string }[];
  speechPaces: { value: string; label: string; description: string }[];
}

/**
 * Capacidades declaradas por um motor. Usado pela UI para habilitar/desabilitar
 * ações e por futuras integrações de provedores (clip IA, avatar, mídia local).
 */
export interface EngineCapabilities {
  urlToVideo: boolean;
  visualGate: boolean;
  editByPrompt: boolean;
  duplicate: boolean;
  resumableRender: boolean;
  visualEditor: boolean;
  /** Provedores de mídia por cena suportados hoje (ver providers/registry). */
  clipProviders: string[];
}

export interface VideoEngine {
  readonly id: EngineId;
  readonly label: string;
  readonly capabilities: EngineCapabilities;

  health(): Promise<EngineHealth>;
  config(): Promise<EngineConfigInfo>;

  // URL → Vídeo (com gate de aprovação da cena-piloto)
  createDirection(input: UrlToVideoInput): Promise<EngineJob>;
  approveDirection(jobId: string): Promise<EngineJob>;
  regenerateDirection(jobId: string): Promise<EngineJob>;

  // jobs
  listJobs(): Promise<EngineJob[]>;
  cancelJob(jobId: string): Promise<EngineJob>;
  retryRender(jobId: string, mode: 'resume' | 'restart'): Promise<EngineJob>;

  // projetos
  listProjects(): Promise<EngineProject[]>;
  editProject(slug: string, input: ProjectTransformInput): Promise<EngineJob>;
  duplicateProject(slug: string, input: ProjectTransformInput): Promise<EngineJob>;
  renderProject(slug: string, opts?: { aspectRatio?: AspectRatio; includeCta?: boolean }): Promise<EngineJob>;
  openEditor(slug: string): Promise<{ url: string }>;

  /** Baixa uma mídia do motor (MP4, thumbnail) como stream. */
  fetchMedia(relPath: string): Promise<{ status: number; contentType: string; body: NodeJS.ReadableStream }>;
}

export class EngineError extends Error {
  constructor(message: string, readonly code: string, readonly status = 500) {
    super(message);
    this.name = 'EngineError';
  }
}

/** Motor presente no código mas sem binários/credenciais para rodar. */
export class EngineNotAvailableError extends EngineError {
  constructor(message: string) {
    super(message, 'ENGINE_NOT_AVAILABLE', 503);
    this.name = 'EngineNotAvailableError';
  }
}

/** Provedor previsto na arquitetura mas ainda não implementado. */
export class EngineNotImplementedError extends EngineError {
  constructor(what: string) {
    super(`${what} ainda não está implementado neste motor.`, 'NOT_IMPLEMENTED', 501);
    this.name = 'EngineNotImplementedError';
  }
}
