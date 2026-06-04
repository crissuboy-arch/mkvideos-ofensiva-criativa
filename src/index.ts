// mkivideos — motor portável de fila de vídeos.
// Núcleo (puro + worker) e contratos. O store SQLite default fica em
// `mkivideos/sqlite-store` (import separado pra não forçar better-sqlite3
// em hosts que tragam o próprio store).

export {
  parseVideoCommand,
  buildVideoPrompt,
  extractResultPath,
  formatQueueList,
  mkiHelpText,
  processNextJob,
  initVideoQueue,
} from './queue.js';

export type {
  VideoJob,
  EnqueueInput,
  QueueStore,
  QueueDeps,
  ParsedCommand,
} from './types.js';
