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
