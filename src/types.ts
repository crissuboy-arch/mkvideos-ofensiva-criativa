// Contratos do motor de fila — host-agnósticos (ports & adapters).
// Um host (openpcbot, openclaw, hermes…) implementa QueueStore + QueueDeps;
// o motor (parse/prompt/worker) não sabe qual bot, DB ou transporte existe.

export interface VideoJob {
  id: number;
  skill: 'explicativo' | 'curso' | 'demo';
  input: string;
  /** JSON: { vertical?: boolean; dest?: string } */
  opts: string | null;
  status: 'queued' | 'running' | 'done' | 'failed' | 'canceled';
  result_path: string | null;
  error: string | null;
  notify: 'sempre' | 'silencioso';
  /** 0 | 1 — anexar o .mp4 ao terminar */
  send_video: number;
  chat_id: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
}

export interface EnqueueInput {
  skill: VideoJob['skill'];
  input: string;
  opts: string | null;
  notify: VideoJob['notify'];
  sendVideo: boolean;
  chatId: string | null;
}

/**
 * Porta de persistência. Implemente sobre qualquer DB (o SQLite default vem em
 * `sqlite-store`; o openpcbot implementa sobre o SQLite dele).
 */
export interface QueueStore {
  enqueue(job: EnqueueInput): number;
  /** Próximo job 'queued' (FIFO: created_at, id) ou null. */
  getNext(): VideoJob | null;
  /** Job 'running' atual ou null (a trava de concorrência = 1). */
  getRunning(): VideoJob | null;
  markRunning(id: number): void;
  markDone(id: number, resultPath: string): void;
  markFailed(id: number, error: string): void;
  /** Cancela só se ainda 'queued'. Retorna se mudou alguma linha. */
  cancel(id: number): boolean;
  list(limit?: number): VideoJob[];
  /** No boot: marca jobs 'running' órfãos (crash/restart) como 'failed'. Retorna quantos. */
  failStaleRunning(): number;
}

/** Porta de IO — efeitos colaterais específicos do host. */
export interface QueueDeps {
  /** Spawna o agente autônomo (ex.: Claude Code) com o prompt e devolve o texto final. */
  runAgent: (prompt: string) => Promise<{ text: string | null }>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  sendDocument: (chatId: string, path: string) => Promise<void>;
  /** Move o .mp4 renderizado para um destino e devolve o caminho final. */
  moveVideo: (src: string, dest: string) => Promise<string>;
}

export type ParsedCommand =
  | { ok: true; skill: VideoJob['skill']; input: string; vertical: boolean; send: boolean; silent: boolean; dest?: string }
  | { ok: false; error: string };
