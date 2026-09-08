// mkivideos — motor universal de vídeos (offline) + fila portável.
// Núcleo: gerador de roteiro (specs) → composer → pipeline. Fila host-agnóstica
// continua em queue/sqlite-store/dashboard (imports separados quando necessário).

// ── fila (host-agnóstica) ──────────────────────────────────────────────────
export {
  parseVideoCommand,
  buildVideoPrompt,
  extractResultPath,
  formatQueueList,
  mkiHelpText,
  processNextJob,
  initVideoQueue,
} from './queue.js';

// ── motor de geração (offline, sem API) ────────────────────────────────────
export { generateScript, narrationTexts } from './specs/script-generator.js';
export { parseTheme, spokenHandle, spokenUrl } from './specs/theme.js';
export { dims, defaultFormatFor, resolveFormat } from './specs/formats.js';
export { VIDEO_TYPES, SCENE_TYPES } from './specs/types.js';

export { compose } from './composer.js';
export { getScene, SCENES } from './scenes/index.js';
export { getTemplate, listTemplates, TEMPLATES } from './templates/index.js';
export { getBrand, listBrands, brandIds, BRANDS, DEFAULT_BRAND } from './brands/index.js';

export { layoutTimeline, DEFAULT_TIMING } from './engine/timing.js';
export { createMotion, TRANS } from './engine/motion.js';
export { buildVideo } from './engine/pipeline.js';

// ── tipos ──────────────────────────────────────────────────────────────────
export type {
  VideoJob,
  EnqueueInput,
  QueueStore,
  QueueDeps,
  ParsedCommand,
} from './types.js';

export type {
  Format,
  VideoType,
  SceneType,
  TransType,
  SceneSpec,
  ScriptSpec,
} from './specs/types.js';

export type { Brand, Palette, Fonts } from './brands/index.js';
export type { BuildRequest, BuildResult, BuildPhase, BuildHooks } from './engine/pipeline.js';

// ── painel de conteúdo (tipos/consts; store+server via 'mkivideos/content') ─
export {
  PLATFORMS, LANGUAGES, CONTENT_STATUSES, platformFormat,
} from './content/types.js';
export type {
  Platform, Language, ContentStatus, ContentItem, ContentInput, DashboardCounts,
  Metrics, Account, AccountInput, LogEntry, LogEvent, BatchVariation,
} from './content/types.js';

// ── publishers (mocks; sem better-sqlite3) ──────────────────────────────────
export { getPublisher, PUBLISHERS } from './publishers/index.js';
export type { Publisher, PublishContext, PublishResult } from './publishers/index.js';

// ── URL → Vídeo (motor content2video como módulo) ──────────────────────────
export { Url2VideoService, url2video } from './url2video/service.js';
export { loadDefaults as url2videoDefaults } from './url2video/config.js';
export { normalizeRequest, normalizeTransform, validateUrl } from './url2video/validate.js';
export { Url2VideoValidationError } from './url2video/types.js';
export type {
  Url2VideoDefaults, Url2VideoRequest, Url2VideoRequestRaw,
} from './url2video/types.js';
export type { Url2VideoStatus } from './url2video/service.js';
export { runUrl2VideoCli, url2videoUsage } from './url2video/cli.js';

// ── camada de motores / provedores (arquitetura extensível) ────────────────
export { getEngine, engineIds, registerEngine } from './engines/registry.js';
export {
  listProviders, getProvider, implementedProviderIds, plannedProviderIds,
} from './engines/providers/registry.js';
export {
  EngineError, EngineNotAvailableError, EngineNotImplementedError,
  ASPECT_RATIOS, CONVERSATION_STYLES, SPEECH_PACES, aspectToFormat, formatToAspect,
} from './engines/types.js';
export type {
  VideoEngine, EngineId, EngineJob, EngineProject, EngineHealth, EngineConfigInfo,
  EngineCapabilities, UrlToVideoInput, AspectRatio, ConversationStyle, SpeechPace,
} from './engines/types.js';
export type { MediaProvider, ProviderId } from './engines/providers/types.js';

// ── preflight ─────────────────────────────────────────────────────────────
export { runDoctor, formatDoctor, parseNodeMajor } from './preflight/doctor.js';
export type { DoctorReport, Check } from './preflight/doctor.js';

// ── env ───────────────────────────────────────────────────────────────────
export { loadEnv } from './env.js';

// ── camada de custo (gate de gasto — nenhum provider pago roda sem confirmação) ──
export { requireAuthorization, ceilingFromEnv, costLedger, recordAuthorized } from './cost/gate.js';
export {
  CostAuthorizationRequiredError, CostCeilingExceededError,
} from './cost/types.js';
export type { CostEstimate, CostLedgerEntry } from './cost/types.js';

// ── Música + Videoclipe (modules/musicavideo) ─────────────────────────────
export { MusicavideoService, musicavideo } from './musicavideo/service.js';
export { runMusicavideoCli, musicavideoUsage } from './musicavideo/cli.js';
export type { EstadoMusicavideo, PlanoMusicavideo, ParteMusicavideo, IndiceLinha } from './musicavideo/types.js';

// ── Otimizar Vídeo (modules/otimizevideo) ─────────────────────────────────
export { OtimizevideoService, otimizevideo } from './otimizevideo/service.js';
export { runOtimizevideoCli, otimizevideoUsage } from './otimizevideo/cli.js';
export type { ModoOtv, PlanoOtv, StatusOtv } from './otimizevideo/types.js';

// ── Legendar (transcrição via otimizevideo + queima FFmpeg própria) ───────
export { LegendasService, legendas } from './legendas/service.js';
export { runLegendasCli, legendasUsage } from './legendas/cli.js';
export { LegendaStore } from './legendas/store.js';
export {
  wordsToCues, cuesToSrt, parseSrt, shiftCues, formatTimestamp,
} from './legendas/srt.js';
export type { Cue, Transcript, PalavraTranscrita } from './legendas/srt.js';
export type { LegendaProject } from './legendas/store.js';

// ── vídeo: wrapper FFmpeg (queima/mux de legenda) ─────────────────────────
export { burnSubtitles, muxSoftSubtitles, escapeSubtitlesPath, ffmpegBin } from './video/ffmpeg.js';
export type { SubtitleStyle } from './video/ffmpeg.js';

// ── Biblioteca (índice unificado, só leitura) ─────────────────────────────
export { scanLibrary, isLibraryPathAllowed } from './biblioteca/index.js';
export type { LibraryItem, LibrarySource } from './biblioteca/index.js';

// ── helpers de ferramentas locais ────────────────────────────────────────
export { runTool, resolvePython, LocalToolError } from './localtools/exec.js';
export { dataRoot, moduleDataDir } from './localtools/datadir.js';
