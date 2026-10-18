// Adapter MKVideos ↔ ATHENA (ContratoPonteV1).
//
// Prepara o MKVideos para ser executor de missões ATHENA do tipo CRIAR_VIDEO,
// no pipeline: TELEGRAM → ATHENA → MKVideos → ATHENA → Telegram → aprovação
// humana → agendamento/publicação.
//
// COMO FUNCIONA:
//   1. A ATHENA entrega um envelope de missão (JSON, ContratoPonteV1) ao
//      adapter — via CLI `mkivideos athena-receive` (stdin ou ficheiro).
//   2. `missionToEnqueue()` valida e traduz a missão num VideoJob da fila
//      (idempotente por mission_id: reenvio não duplica).
//   3. A fila existente processa o job (nenhuma mudança no motor).
//   4. `mkivideos athena-status --mission <id>` devolve o resultado no formato
//      que a ATHENA consome no callback (poll/outbox).
//
// O QUE ESTE MÓDULO NÃO FAZ: não altera a ATHENA (o Executor Real da Fase 7 é
// quem chama este adapter); não publica nada sozinho — `requires_human_approval`
// mapeia para notify+send_video, e a publicação continua sendo decisão humana
// via Telegram, como no pipeline alvo.

import type { EnqueueInput, QueueStore, VideoJob } from '../types.js';
import { EngineError } from '../engines/types.js';

/** Subconjunto do envelope ContratoPonteV1 relevante para CRIAR_VIDEO. */
export interface AthenaMission {
  schema_version: string;
  mission_id: string;
  handoff_id?: string | null;
  source?: string;
  mission_type: string;
  objective: string;
  priority?: string;
  risk_class?: string;
  requires_human_approval?: boolean;
  /** requested_outputs do contrato (ex.: ["video"]). */
  requested_outputs?: string[];
  /** Contexto livre; `video_skill` e `vertical` são lidos daqui. */
  context?: Record<string, unknown> | null;
  final_action?: string;
}

export type AthenaJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface AthenaResult {
  mission_id: string;
  status: AthenaJobStatus;
  outputs: { video: string } | null;
  error: string | null;
}

const MISSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/;
const SKILLS = ['explicativo', 'curso', 'demo'] as const;
type Skill = (typeof SKILLS)[number];

function fail(msg: string): never {
  throw new EngineError(`Athena: ${msg}`, 'ATHENA_MISSION_INVALID', 422);
}

/** Lê o mission_id guardado no opts JSON de um job (idempotência). */
function jobMissionId(job: VideoJob): string | null {
  if (!job.opts) return null;
  try {
    const o = JSON.parse(job.opts) as { athena_mission_id?: unknown };
    return typeof o.athena_mission_id === 'string' ? o.athena_mission_id : null;
  } catch {
    return null;
  }
}

/** Procura job já criado para esta missão (reenvio idempotente). */
export function findJobByMission(store: QueueStore, missionId: string): VideoJob | null {
  for (const job of store.list(1000)) {
    if (jobMissionId(job) === missionId) return job;
  }
  return null;
}

function resolveSkill(mission: AthenaMission): Skill {
  const ctx = mission.context ?? {};
  const s = ctx['video_skill'];
  if (typeof s === 'string' && (SKILLS as readonly string[]).includes(s)) return s as Skill;
  return 'explicativo';
}

/**
 * Valida o envelope e traduz para um EnqueueInput da fila.
 * Lança EngineError (422) se a missão for inválida para este executor.
 */
export function missionToEnqueueInput(mission: AthenaMission): EnqueueInput {
  if (!mission || typeof mission !== 'object') fail('envelope vazio ou inválido');
  if (mission.mission_type !== 'CRIAR_VIDEO') {
    fail(`mission_type '${mission.mission_type}' não suportado por este executor (só CRIAR_VIDEO)`);
  }
  if (!mission.mission_id || !MISSION_ID_RE.test(mission.mission_id)) {
    fail('mission_id ausente ou em formato inválido');
  }
  if (!mission.objective || !mission.objective.trim()) fail('objective ausente');
  if (mission.requested_outputs && !mission.requested_outputs.includes('video')) {
    fail('requested_outputs não inclui "video"');
  }

  const ctx = mission.context ?? {};
  const opts: Record<string, unknown> = {
    athena_mission_id: mission.mission_id,
  };
  if (ctx['vertical'] === true) opts['vertical'] = true;
  if (typeof mission.handoff_id === 'string' && mission.handoff_id) {
    opts['athena_handoff_id'] = mission.handoff_id;
  }

  // Pipeline alvo: com aprovação humana, o vídeo vai ao Telegram (notify +
  // send_video); sem ela, o resultado volta só pelo callback.
  const needsApproval = mission.requires_human_approval === true;
  return {
    skill: resolveSkill(mission),
    input: mission.objective.trim(),
    opts: JSON.stringify(opts),
    notify: 'sempre',
    sendVideo: needsApproval,
    chatId: 'athena',
  };
}

/**
 * Enfileira a missão (idempotente). Retorna o job id — novo ou já existente
 * quando a missão foi reenviada.
 */
export function receiveMission(
  store: QueueStore,
  mission: AthenaMission,
): { jobId: number; deduped: boolean } {
  const existing = mission.mission_id ? findJobByMission(store, mission.mission_id) : null;
  if (existing) return { jobId: existing.id, deduped: true };
  const input = missionToEnqueueInput(mission);
  const jobId = store.enqueue(input);
  return { jobId, deduped: false };
}

/** Traduz um VideoJob para o resultado que a ATHENA consome (poll/outbox). */
export function jobToAthenaResult(job: VideoJob): AthenaResult {
  const missionId = jobMissionId(job) ?? '';
  if (job.status === 'done') {
    return { mission_id: missionId, status: 'done', outputs: { video: job.result_path ?? '' }, error: null };
  }
  if (job.status === 'failed' || job.status === 'canceled') {
    return {
      mission_id: missionId,
      status: 'failed',
      outputs: null,
      error: job.error ?? 'job sem vídeo gerado',
    };
  }
  return { mission_id: missionId, status: job.status, outputs: null, error: null };
}

/** Estado de uma missão para `athena-status` (poll). */
export function missionStatus(store: QueueStore, missionId: string): AthenaResult {
  const job = findJobByMission(store, missionId);
  if (!job) {
    throw new EngineError(`Athena: missão '${missionId}' sem job na fila`, 'ATHENA_MISSION_UNKNOWN', 404);
  }
  return jobToAthenaResult(job);
}
