// Subsistema do Painel de Produção de Conteúdo.
// Import separado (mkivideos/content) — traz better-sqlite3 só para quem usa o painel.

export { SqliteContentStore, weekRange, ymd } from './store.js';
export { createPanelServer, getPanelHtml } from './panel.js';
export type { PanelOptions } from './panel.js';
export {
  PLATFORMS, LANGUAGES, CONTENT_STATUSES, PENDING_STATUSES,
  PLATFORM_LABEL, LANGUAGE_LABEL, platformFormat,
  isPlatform, isLanguage, isStatus,
} from './types.js';
export type {
  ContentItem, ContentInput, ContentPatch, ContentFilters, DashboardCounts,
  Platform, Language, ContentStatus,
} from './types.js';
