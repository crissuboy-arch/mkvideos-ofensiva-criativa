// Cliente server-side da API do MoneyPrinterTurbo (upstream harry0703/
// MoneyPrinterTurbo, MIT — só o contrato da API é reutilizado aqui).
//
// O motor corre isolado (processo próprio ou contentor) e expõe HTTP em
// loopback ou HTTPS. Este cliente NUNCA corre no browser: a chave viaja no
// cabeçalho `x-api-key` e o download de artefactos exige o mesmo cabeçalho.
//
// Endpoints confirmados no upstream (auditoria 27/10/2026):
//   POST /api/v1/videos, GET /api/v1/tasks/{id},
//   GET /api/v1/download/{id}/{ficheiro}, DELETE /api/v1/tasks/{id}.
// Envelope: { status: 200, message, data }. Fila: 5 concorrentes / 100 em
// espera por omissão; cheia responde HTTP 429 (nunca reenviado aqui).
// O upstream aceita chave vazia (sem autenticação); este cliente EXIGE
// sempre chave — mais restrito que o upstream, de propósito.

import { EngineError, EngineNotAvailableError } from '../types.js';

export type MptAspect = '9:16' | '16:9' | '1:1';

export interface MptVideoMaterial {
  provider?: string;
  url: string;
  duration?: number;
}

export interface MptVideoRequest {
  video_subject: string;
  video_script?: string;
  video_terms?: string | string[];
  video_language?: string;
  video_aspect?: MptAspect;
  video_source?: string;
  video_materials?: MptVideoMaterial[];
  voice_name?: string;
  bgm_type?: string;
  subtitle_enabled?: boolean;
  video_count?: number;
  video_clip_duration?: number;
  /** Só aceite pelo motor quando já está dentro do diretório da tarefa. */
  custom_audio_file?: string;
  [key: string]: unknown;
}

export interface MptEnvelope<T> {
  status: number;
  message?: string;
  data: T;
}

export interface MptTaskStatus {
  task_id: string;
  state: number;
  progress?: number;
  videos?: string[];
  combined_videos?: string[];
  failed_stage?: string | null;
  error?: string | null;
  [key: string]: unknown;
}

/** Estados de tarefa do upstream (app/models/const.py). */
export const MPT_TASK_STATE = {
  FAILED: -1,
  COMPLETE: 1,
  PROCESSING: 4,
} as const;

export function isTerminalMptState(state: number): boolean {
  return state === MPT_TASK_STATE.COMPLETE || state === MPT_TASK_STATE.FAILED;
}

export interface MptConfig {
  baseUrl: string;
  key: string;
  timeoutMs: number;
  maxInflight: number;
}

function parseIntEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new EngineError(`${name} inválido.`, 'MPT_CONFIG', 500);
  return value;
}

/**
 * Configuração a partir do ambiente. Lança EngineNotAvailableError quando
 * falta base ou chave — o motor fica inativo em vez de falhar a meio.
 */
export function loadMptConfig(env: NodeJS.ProcessEnv = process.env): MptConfig {
  const configured = env.MPT_API_BASE_URL;
  const key = env.MPT_API_KEY;
  if (!configured || !key) {
    throw new EngineNotAvailableError(
      'MoneyPrinterTurbo não configurado (MPT_API_BASE_URL e MPT_API_KEY).',
    );
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new EngineError('MPT_API_BASE_URL inválida.', 'MPT_CONFIG', 500);
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || url.username || url.password || url.search || url.hash) {
    throw new EngineError('MPT_API_BASE_URL inválida.', 'MPT_CONFIG', 500);
  }
  const timeoutMs = Math.min(300_000, Math.max(1_000, parseIntEnv(env, 'MPT_TIMEOUT_MS', 60_000)));
  const maxInflight = parseIntEnv(env, 'MPT_MAX_INFLIGHT', 5);
  if (maxInflight < 0) throw new EngineError('MPT_MAX_INFLIGHT inválido.', 'MPT_CONFIG', 500);
  return { baseUrl: url.origin, key, timeoutMs, maxInflight };
}

// Guarda local espelhando o limite do upstream (5 concorrentes). A
// fiscalização real continua no motor (HTTP 429 quando a fila enche).
let inFlightCreates = 0;

/** Só para testes: repõe o contador de criações em curso. */
export function _resetMptInflight(): void {
  inFlightCreates = 0;
}

async function callMpt<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
  env: NodeJS.ProcessEnv = process.env,
  timeoutOverrideMs?: number,
): Promise<T> {
  const { baseUrl, key, timeoutMs } = loadMptConfig(env);
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      'x-api-key': key,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeoutOverrideMs ?? timeoutMs),
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new EngineError(
        'MoneyPrinterTurbo fila cheia (HTTP 429); tentar mais tarde, sem reenviar automaticamente.',
        'MPT_QUEUE_FULL',
        429,
      );
    }
    if (response.status === 401) {
      throw new EngineError('MoneyPrinterTurbo rejeitou a chave (HTTP 401).', 'MPT_UNAUTHORIZED', 401);
    }
    throw new EngineError(`MoneyPrinterTurbo HTTP ${response.status}.`, 'MPT_HTTP', response.status);
  }
  const result = (await response.json()) as MptEnvelope<T>;
  if (result.status !== 200 || result.data == null) {
    throw new EngineError('MoneyPrinterTurbo rejeitou a operação.', 'MPT_REJECTED', 502);
  }
  return result.data;
}

export async function submitMptVideo(
  body: MptVideoRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ task_id: string }> {
  if (!body.video_subject?.trim()) {
    throw new EngineError('Assunto obrigatório.', 'MPT_VALIDATION', 400);
  }
  const { maxInflight } = loadMptConfig(env);
  if (inFlightCreates >= maxInflight) {
    throw new EngineError('MoneyPrinterTurbo limite de tarefas simultâneas atingido.', 'MPT_LIMIT', 429);
  }
  inFlightCreates += 1;
  try {
    return await callMpt<{ task_id: string }>('/api/v1/videos', 'POST', body, env);
  } finally {
    inFlightCreates -= 1;
  }
}

export async function getMptTask(
  taskId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, unknown>> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(taskId)) {
    throw new EngineError('ID de tarefa inválido.', 'MPT_VALIDATION', 400);
  }
  return callMpt<Record<string, unknown>>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, 'GET', undefined, env);
}

export async function getMptTaskStatus(
  taskId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MptTaskStatus> {
  const data = await getMptTask(taskId, env);
  if (typeof data.task_id !== 'string' || typeof data.state !== 'number') {
    throw new EngineError('MoneyPrinterTurbo devolveu um estado de tarefa inválido.', 'MPT_REJECTED', 502);
  }
  return data as unknown as MptTaskStatus;
}

export async function cancelMptTask(
  taskId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, unknown>> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(taskId)) {
    throw new EngineError('ID de tarefa inválido.', 'MPT_VALIDATION', 400);
  }
  return callMpt<Record<string, unknown>>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, 'DELETE', undefined, env);
}

export interface MptPollOptions {
  intervalMs?: number;
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Espera até COMPLETE ou FAILED. Nunca republica, nunca recria a tarefa.
 * Lança em FAILED (com etapa e erro do upstream) e em timeout.
 */
export async function pollMptTask(
  taskId: string,
  options: MptPollOptions = {},
): Promise<MptTaskStatus> {
  const intervalMs = Math.max(250, options.intervalMs ?? 2000);
  const maxWaitMs = Math.max(1000, options.maxWaitMs ?? 600_000);
  const sleep = options.sleep ?? defaultSleep;
  const env = options.env ?? process.env;
  const started = Date.now();
  for (;;) {
    const status = await getMptTaskStatus(taskId, env);
    if (status.state === MPT_TASK_STATE.COMPLETE) return status;
    if (status.state === MPT_TASK_STATE.FAILED) {
      throw new EngineError(
        `MoneyPrinterTurbo falhou (etapa: ${status.failed_stage ?? 'desconhecida'}): ${status.error ?? 'sem detalhe'}`,
        'MPT_FAILED',
        502,
      );
    }
    if (Date.now() - started >= maxWaitMs) {
      throw new EngineError('MoneyPrinterTurbo excedeu o tempo de espera da tarefa.', 'MPT_TIMEOUT', 504);
    }
    await sleep(intervalMs);
  }
}

/** URLs de artefactos exatamente como o upstream as reporta. */
export function getMptTaskVideoUrls(status: MptTaskStatus | Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ['videos', 'combined_videos'] as const) {
    const value = (status as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === 'string') out.push(entry);
    }
  }
  return out;
}

/**
 * Baixa um artefacto de tarefa pelo servidor (a chave viaja no cabeçalho).
 * Só caminhos relativos dentro de `tasks/<id>/<ficheiro>` — nunca absolutos
 * nem com `..`. Devolve Buffer (Node).
 */
export async function downloadMptArtifact(
  entry: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  let path = entry.trim();
  if (/^https?:\/\//.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      throw new EngineError('URL de artefacto inválida.', 'MPT_VALIDATION', 400);
    }
  }
  path = path.replace(/^\/+/, '');
  if (!path.startsWith('tasks/')) {
    throw new EngineError('Artefacto fora do diretório de tarefas.', 'MPT_VALIDATION', 400);
  }
  const remainder = path.slice('tasks/'.length);
  const segments = remainder.split('/');
  if (segments.length < 2 || segments.some((s) => s === '' || s === '..' || s.includes('\\'))) {
    throw new EngineError('Caminho de artefacto inválido.', 'MPT_VALIDATION', 400);
  }
  const { baseUrl, key, timeoutMs } = loadMptConfig(env);
  const response = await fetch(new URL(`/api/v1/download/${remainder}`, baseUrl), {
    headers: { 'x-api-key': key },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new EngineError(`MoneyPrinterTurbo HTTP ${response.status} ao baixar artefacto.`, 'MPT_HTTP', response.status);
  }
  return Buffer.from(await response.arrayBuffer());
}

export interface MptPtBrVerticalInput {
  subject: string;
  script?: string;
  terms?: string | string[];
  materials?: MptVideoMaterial[];
  voiceName?: string;
  bgmType?: string;
  clipDuration?: number;
}

/**
 * Pedido PT-BR vertical (9:16) para o motor isolado. Sem materiais, a fonte
 * fica por omissão no upstream (pexels, que exige chave) — quem chama não
 * deve assumir que existe chave de stock. Com materiais locais, a fonte é
 * "local" e nenhuma chave de stock é precisa.
 */
export function buildMptPtBrVerticalRequest(input: MptPtBrVerticalInput): MptVideoRequest {
  if (!input.subject?.trim()) {
    throw new EngineError('Assunto obrigatório.', 'MPT_VALIDATION', 400);
  }
  const request: MptVideoRequest = {
    video_subject: input.subject.trim(),
    video_language: 'pt-BR',
    video_aspect: '9:16',
    voice_name: input.voiceName ?? 'pt-BR-FranciscaNeural',
    subtitle_enabled: true,
    video_count: 1,
    video_clip_duration: input.clipDuration ?? 5,
  };
  if (input.script?.trim()) request.video_script = input.script.trim();
  if (input.terms) request.video_terms = input.terms;
  if (input.bgmType) request.bgm_type = input.bgmType;
  if (input.materials?.length) {
    request.video_source = 'local';
    request.video_materials = input.materials;
  }
  return request;
}
