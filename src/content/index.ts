// Subsistema do Centro de Operações de Conteúdo.
// Import separado (mkivideos/content) — traz better-sqlite3 só para quem usa.

export { SqliteContentStore, weekRange, ymd, nowLocalIso, DEFAULT_ACCOUNTS } from './store.js';
export { createPanelServer, getPanelHtml } from './panel.js';
export type { PanelOptions } from './panel.js';
export { startScheduler, runDuePublications } from './scheduler.js';
export type { SchedulerHandle, SchedulerOptions } from './scheduler.js';
export { getPublisher, PUBLISHERS } from '../publishers/index.js';
export type { Publisher, PublishContext, PublishResult } from '../publishers/index.js';
export {
  PLATFORMS, LANGUAGES, CONTENT_STATUSES, PENDING_STATUSES, DEFAULT_TZ,
  PLATFORM_LABEL, LANGUAGE_LABEL, platformFormat,
  isPlatform, isLanguage, isStatus,
} from './types.js';
export type {
  ContentItem, ContentInput, ContentPatch, ContentFilters, DashboardCounts, Metrics,
  Account, AccountInput, LogEntry, LogEvent, BatchVariation,
  Platform, Language, ContentStatus,
} from './types.js';
